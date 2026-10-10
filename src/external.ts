/**
 * External judges — people, or agents outside the harness — grading the same
 * rubrics under the same blinding.
 *
 *   judge-export  one Markdown grading packet per deliverable, named by a
 *                 random id. The id → system key is written separately and is
 *                 never given to a judge. Packets are dealt into batches so no
 *                 judge ever sees two deliverables for the same task — a judge
 *                 cannot compare systems, only apply the rubric.
 *   judge-import  the judges' verdict files, mapped back through the key into
 *                 ordinary grade files, so `pif report` treats them like any
 *                 other judge.
 *
 * Fixture deliverables can be mixed into the pool unmarked: the judges cannot
 * tell them from real ones, so calibration measures the judges as they
 * actually graded.
 */
import { createHash, randomInt } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { z } from 'zod'
import { sampleTask } from './prompt'
import { blind, REDACTION_SIGNATURE } from './redact'
import { deliverableHash, readOutputs, type StoredGrade, writeGrade } from './results'
import type { CriterionGrade } from './score'
import { rng } from './stats'
import { fileByPath, ROOT, type Task } from './tasks'

export interface KeyEntry {
  runDir: string
  candidate: string
  task: string
  attempt: number
  /** The task's full hash at export: grades are recorded against the rubric the judge actually saw. */
  taskHash: string
  /** deliverableHash() of the unblinded text the packet was made from. */
  deliverableHash: string
}

export interface JudgingKey {
  meta: { seed: number; protocol: string; createdAt: string }
  entries: Record<string, KeyEntry>
}

export interface ExportResult {
  packets: number
  batches: string[][]
}

/** A stable, unguessable-looking id per deliverable: same seed and deliverable → same id. */
function anonId(seed: number, key: string): string {
  return `J-${createHash('sha256').update(`${seed}\0${key}`).digest('hex').slice(0, 6)}`
}

export function packetMarkdown(id: string, task: Task, deliverable: string): string {
  const refPaths = [...new Set(task.spec.criteria.flatMap((c) => c.sources))]
  const refs = refPaths
    .map((p) => {
      const f = fileByPath(task, p)!
      return `### ${p}\n\n\`\`\`\`text\n${f.content.trimEnd()}\n\`\`\`\``
    })
    .join('\n\n')
  const criteria = task.spec.criteria
    .map((c) => `### ${c.id} — ${c.title}\n\n${c.match_criteria}${c.sources.length ? `\n\n*Reference files for this criterion:* ${c.sources.join(', ')}` : ''}`)
    .join('\n\n')
  return `# Grading packet ${id}

## The assignment the system was given

**${task.spec.title}** · scenario date ${task.spec.as_of}

${task.spec.instructions.trim()}

## The deliverable (blinded)

\`\`\`\`markdown
${deliverable.trim()}
\`\`\`\`

## Criteria

Grade each criterion on its own, in order.

${criteria}
${refs ? `\n## Reference files (ground truth for the criteria that name them)\n\n${refs}\n` : ''}
## Your verdict file

Write \`${id}.json\`:

\`\`\`json
{"packet": "${id}", "criteria": [{"id": "C-001", "verdict": "pass", "reasoning": "2-4 sentences, quoting the deliverable where it decides the verdict"}]}
\`\`\`

One entry per criterion, every criterion, in order. Verdicts are "pass" or "fail" — nothing else.
`
}

/** The external grading protocol: the packet template and the blinding rules. */
export const EXTERNAL_PROTOCOL = createHash('sha256')
  .update(`${packetMarkdown('J-000000', sampleTask(), 'SAMPLE')}\0${REDACTION_SIGNATURE}`)
  .digest('hex')
  .slice(0, 12)

/** Every packet gets the same timestamp, so file times reveal nothing about export order. */
const PACKET_MTIME = new Date('2026-01-01T00:00:00Z')

/**
 * Write packets, the key and the batch plan. `runs` may hold real runs and a
 * calibration run; every deliverable for a selected task is exported.
 */
export function exportJudging(opts: {
  runDirs: string[]
  tasks: Task[]
  outDir: string
  keyFile: string
  /** Omit for a random seed (recorded only in the key). A fixed seed is for tests. */
  seed?: number
  batchSize: number
  candidates?: string[]
  blindTerms?: string[]
}): ExportResult {
  const seed = opts.seed ?? randomInt(1, 2 ** 31 - 1)
  const byId = new Map(opts.tasks.map((t) => [t.id, t]))
  const packetsDir = join(opts.outDir, 'packets')
  mkdirSync(packetsDir, { recursive: true })
  const entries: Record<string, KeyEntry> = {}
  const texts = new Map<string, string>()
  const byTask = new Map<string, string[]>()
  for (const runDir of opts.runDirs) {
    for (const o of readOutputs(runDir)) {
      const t = byId.get(o.task)
      if (!t || (opts.candidates && !opts.candidates.includes(o.candidate))) continue
      // Repo-relative, so the same seed gives the same ids in any checkout.
      const id = anonId(seed, `${relative(ROOT, runDir)}\0${o.candidate}\0${o.task}\0${o.attempt}`)
      if (entries[id]) throw new Error(`anonymous id collision on ${id} — change the seed`)
      entries[id] = { runDir, candidate: o.candidate, task: o.task, attempt: o.attempt, taskHash: t.hash, deliverableHash: deliverableHash(o.text) }
      texts.set(id, packetMarkdown(id, t, blind(o.text, opts.blindTerms)))
      byTask.set(o.task, [...(byTask.get(o.task) ?? []), id])
    }
  }
  const rand = rng(seed)
  const shuffle = <T>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[xs[i], xs[j]] = [xs[j]!, xs[i]!]
    }
    return xs
  }
  // Written in shuffled order with one timestamp: neither listing order nor file times follow the systems.
  for (const id of shuffle(Object.keys(entries))) {
    const path = join(packetsDir, `${id}.md`)
    writeFileSync(path, texts.get(id)!)
    utimesSync(path, PACKET_MTIME, PACKET_MTIME)
  }
  // Deal round-robin, task by task: a task's packets land in different batches as long as no task has more packets than there are batches.
  const ids = Object.keys(entries)
  const maxPerTask = Math.max(0, ...[...byTask.values()].map((v) => v.length))
  const nBatches = Math.max(maxPerTask, Math.ceil(ids.length / opts.batchSize))
  const batches: string[][] = Array.from({ length: nBatches }, () => [])
  let k = 0
  for (const task of shuffle([...byTask.keys()].sort())) for (const id of shuffle([...byTask.get(task)!])) batches[k++ % nBatches]!.push(id)
  for (const b of batches) shuffle(b)
  writeFileSync(join(opts.outDir, 'batches.json'), `${JSON.stringify(batches, null, 2)}\n`)
  mkdirSync(join(opts.keyFile, '..'), { recursive: true })
  const key: JudgingKey = { meta: { seed, protocol: EXTERNAL_PROTOCOL, createdAt: new Date().toISOString() }, entries }
  writeFileSync(opts.keyFile, `${JSON.stringify(key, null, 2)}\n`)
  return { packets: ids.length, batches }
}

const VerdictFile = z.object({
  packet: z.string(),
  criteria: z.array(z.object({ id: z.string(), verdict: z.enum(['pass', 'fail']), reasoning: z.string() })),
})

export interface ImportVerdictsResult {
  imported: number
  missing: string[]
  invalid: { packet: string; error: string }[]
}

/**
 * Map verdict files back through the key into grade files under each deliverable's run directory.
 * A file is rejected — never half-imported — if it misses a criterion, repeats one, names an unknown
 * one, or if the deliverable has changed since the packet was made.
 */
export function importVerdicts(opts: { verdictsDir: string; keyFile: string; tasks: Task[]; judge: string; judgeModel: string }): ImportVerdictsResult {
  const key = JSON.parse(readFileSync(opts.keyFile, 'utf8')) as JudgingKey
  if (!key.meta || !key.entries) throw new Error(`${opts.keyFile} is not a judging key (no meta/entries)`)
  const byId = new Map(opts.tasks.map((t) => [t.id, t]))
  const result: ImportVerdictsResult = { imported: 0, missing: [], invalid: [] }
  const files = existsSync(opts.verdictsDir) ? new Set(readdirSync(opts.verdictsDir).filter((f) => f.endsWith('.json'))) : new Set<string>()
  for (const [id, entry] of Object.entries(key.entries)) {
    if (!files.has(`${id}.json`)) {
      result.missing.push(id)
      continue
    }
    try {
      const v = VerdictFile.parse(JSON.parse(readFileSync(join(opts.verdictsDir, `${id}.json`), 'utf8')))
      if (v.packet !== id) throw new Error(`file names packet ${v.packet}`)
      const t = byId.get(entry.task)
      if (!t) throw new Error(`task ${entry.task} no longer exists`)
      const want = t.spec.criteria.map((c) => c.id)
      const got = v.criteria.map((c) => c.id)
      const dup = got.filter((c, i) => got.indexOf(c) !== i)
      if (dup.length) throw new Error(`repeats ${[...new Set(dup)].join(', ')}`)
      const unknown = got.filter((c) => !want.includes(c))
      if (unknown.length) throw new Error(`verdicts for unknown criteria ${unknown.join(', ')}`)
      const absent = want.filter((c) => !got.includes(c))
      if (absent.length) throw new Error(`no verdict for ${absent.join(', ')}`)
      const out = readOutputs(entry.runDir).find((o) => o.candidate === entry.candidate && o.task === entry.task && o.attempt === entry.attempt)
      if (!out) throw new Error('the deliverable no longer exists')
      if (deliverableHash(out.text) !== entry.deliverableHash) throw new Error('the deliverable changed after the packet was made — re-export it')
      const byCrit = new Map(v.criteria.map((c) => [c.id, c]))
      const criteria: CriterionGrade[] = want.map((c) => ({ id: c, verdict: byCrit.get(c)!.verdict, reasoning: byCrit.get(c)!.reasoning }))
      const grade: StoredGrade = {
        judge: opts.judge,
        judgeModel: opts.judgeModel,
        candidate: entry.candidate,
        task: entry.task,
        attempt: entry.attempt,
        taskHash: entry.taskHash,
        deliverableHash: entry.deliverableHash,
        protocol: key.meta.protocol,
        criteria,
        costUsd: 0,
        usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
        gradedAt: new Date().toISOString(),
      }
      writeGrade(entry.runDir, grade)
      result.imported++
    } catch (e) {
      result.invalid.push({ packet: id, error: (e as Error).message })
    }
  }
  return result
}
