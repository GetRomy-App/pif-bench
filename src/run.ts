/**
 * Producing deliverables: run API candidates on packet tasks, or import what
 * a product (Rōmy, ChatGPT, Claude.ai, Gemini) wrote when a person ran the
 * task in its own interface. Both land in the same store and are graded the
 * same way.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { CandidateSpec } from './config'
import { mapLimit, type ModelCaller } from './models'
import { candidateMessages } from './prompt'
import { outputPath, writeFailure, writeOutput } from './results'
import type { Task } from './tasks'

export interface RunOptions {
  runDir: string
  tasks: Task[]
  candidates: CandidateSpec[]
  attempts: number
  concurrency: number
  caller: ModelCaller
  log?: (line: string) => void
}

export interface RunSummary {
  produced: number
  skipped: number
  failed: { candidate: string; task: string; attempt: number; error: string }[]
  costUsd: number
}

export async function runCandidates(opts: RunOptions): Promise<RunSummary> {
  const log = opts.log ?? (() => {})
  const jobs: { c: CandidateSpec; t: Task; attempt: number }[] = []
  let skipped = 0
  for (const c of opts.candidates) {
    if (!c.model) {
      log(`· ${c.id}: no gateway model — import its outputs instead (pif import)`)
      continue
    }
    for (const t of opts.tasks) {
      if (t.spec.track === 'live') continue // live tasks need the product's own web research — imported, never API-run
      for (let a = 1; a <= opts.attempts; a++) {
        const path = outputPath(opts.runDir, c.id, t.id, a)
        // An existing deliverable is reused only if it was produced from the task's current prompt.
        const meta = existsSync(path.replace(/\.md$/, '.meta.json')) ? (JSON.parse(readFileSync(path.replace(/\.md$/, '.meta.json'), 'utf8')) as { promptHash?: string }) : null
        if (existsSync(path) && meta?.promptHash === t.promptHash) skipped++
        else {
          if (existsSync(path)) log(`↻ ${c.id} · ${t.id} · a${a}: produced from an older prompt — regenerating`)
          jobs.push({ c, t, attempt: a })
        }
      }
    }
  }
  const summary: RunSummary = { produced: 0, skipped, failed: [], costUsd: 0 }
  await mapLimit(jobs, opts.concurrency, async ({ c, t, attempt }) => {
    const { system, messages } = candidateMessages(t)
    try {
      const r = await opts.caller({
        model: c.model!,
        system,
        messages,
        maxOutputTokens: c.maxOutputTokens,
        temperature: c.temperature,
        providerOptions: c.providerOptions,
        tags: ['candidate', c.id],
      })
      if (!r.text.trim()) throw new Error(`empty deliverable (finish: ${r.finishReason})`)
      writeOutput(opts.runDir, r.text, {
        candidate: c.id,
        task: t.id,
        attempt,
        promptHash: t.promptHash,
        source: 'api',
        model: c.model,
        finishReason: r.finishReason,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: r.costUsd,
        latencyMs: r.latencyMs,
        createdAt: new Date().toISOString(),
      })
      summary.produced++
      if (Number.isFinite(r.costUsd)) summary.costUsd += r.costUsd
      log(`✓ ${c.id} · ${t.id} · a${attempt} — ${r.outputTokens} tok out, $${Number.isFinite(r.costUsd) ? r.costUsd.toFixed(4) : '?'}, ${(r.latencyMs / 1000).toFixed(0)} s${r.finishReason === 'length' ? ' · TRUNCATED at max tokens' : ''}`)
    } catch (e) {
      const error = (e as Error).message
      summary.failed.push({ candidate: c.id, task: t.id, attempt, error })
      writeFailure(opts.runDir, { candidate: c.id, task: t.id, attempt, error, failedAt: new Date().toISOString() })
      log(`✗ ${c.id} · ${t.id} · a${attempt} — ${error}`)
    }
  })
  return summary
}

export interface ImportOptions {
  runDir: string
  candidate: string
  /** A directory of `<task-id>.md` files — nested (`live-prospects/agnes-gund.md`) or flat with `__` for `/`. */
  from: string
  tasks: Task[]
  attempt: number
  collectedAt?: string
  notes?: string
  overwrite?: boolean
}

export function importOutputs(opts: ImportOptions): { imported: string[]; unknown: string[]; skipped: string[] } {
  const byId = new Map(opts.tasks.map((t) => [t.id, t]))
  const files: string[] = []
  const walk = (d: string) => {
    for (const n of readdirSync(d).sort()) {
      const full = join(d, n)
      if (statSync(full).isDirectory()) walk(full)
      else if (n.endsWith('.md')) files.push(full)
    }
  }
  walk(opts.from)
  const result = { imported: [] as string[], unknown: [] as string[], skipped: [] as string[] }
  for (const f of files) {
    const id = relative(opts.from, f).split(sep).join('/').replace(/\.md$/, '').replace(/__/g, '/')
    const task = byId.get(id)
    if (!task) {
      result.unknown.push(id)
      continue
    }
    const dest = outputPath(opts.runDir, opts.candidate, id, opts.attempt)
    if (existsSync(dest) && !opts.overwrite) {
      result.skipped.push(id)
      continue
    }
    writeOutput(opts.runDir, readFileSync(f, 'utf8'), {
      candidate: opts.candidate,
      task: id,
      attempt: opts.attempt,
      promptHash: task.promptHash,
      source: 'import',
      createdAt: new Date().toISOString(),
      importedFrom: relative(process.cwd(), f),
      collectedAt: opts.collectedAt,
      notes: opts.notes,
    })
    result.imported.push(id)
  }
  return result
}

/** Write each task's fixtures as the deliverables of two pseudo-candidates, for judge calibration. */
export function stageFixtures(runDir: string, tasks: Task[]): number {
  let n = 0
  for (const t of tasks) {
    if (!t.fixtures) continue
    for (const kind of ['reference', 'flawed'] as const) {
      writeOutput(runDir, t.fixtures[kind], {
        candidate: `fixture-${kind}`,
        task: t.id,
        attempt: 1,
        promptHash: t.promptHash,
        source: 'fixture',
        createdAt: new Date().toISOString(),
      })
      n++
    }
  }
  return n
}
