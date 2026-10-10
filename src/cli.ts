#!/usr/bin/env bun
/**
 * pif — the PIF-Bench v2 command line.
 *
 *   bun pif list [selector]                 tasks, criteria counts
 *   bun pif validate                        offline integrity of every task (CI runs this)
 *   bun pif prompt <task-id>                the exact prompt a system receives (paste it into a product)
 *   bun pif estimate --tasks S [--candidates a,b]          rough cost before you spend anything
 *   bun pif run --run NAME --tasks S [--candidates a,b] [--attempts 1] [--concurrency 4]
 *   bun pif import --run NAME --candidate ID --from DIR [--attempt 1] [--collected-at DATE] [--notes TEXT] [--overwrite]
 *   bun pif grade --run NAME --tasks S [--candidates a,b] [--judges a,b] [--concurrency 4]
 *   bun pif report --run NAME --tasks S
 *   bun pif calibrate --run NAME --tasks S [--judges a,b]  judge accuracy on every task's fixtures
 *
 *   bun pif judge-export --runs DIR[,DIR] --tasks S --out DIR --key FILE [--seed N] [--batch-size 8]
 *   bun pif judge-import --verdicts DIR --key FILE --judge ID --model NAME --tasks S
 *                                           external judges (people or agents): blinded packets out, verdicts in
 *
 * --panel FILE grades with another panel file instead of panel.json (e.g. panels/alternates.json).
 * Selector S: `all`, `packet`, `live`, an area, or a task id — comma-separated.
 */
import { join, resolve } from 'node:path'
import { loadCandidates, loadPanel, type Panel } from './config'
import { exportJudging, importVerdicts } from './external'
import { gradeRun } from './grade'
import { checkAll } from './integrity'
import { assertGatewayCredentials, gatewayCaller } from './models'
import { candidateMessages, JUDGE_SYSTEM, judgeMessages } from './prompt'
import { buildCalibration, buildReport } from './report'
import { resolveRunDir, writeJson, writeText } from './results'
import { importOutputs, runCandidates, stageFixtures } from './run'
import { loadTask, selectTasks } from './tasks'

/** Flags that take no value: they never swallow the next word ("--report-only yes" is an error, not a paid run). */
const BOOLEAN_FLAGS = new Set(['report-only', 'overwrite'])

function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (BOOLEAN_FLAGS.has(key)) flags[key] = true
      else if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else flags[key] = true
    } else positional.push(a)
  }
  return { positional, flags }
}

const { positional, flags } = parseArgs(process.argv.slice(2))
for (const k of BOOLEAN_FLAGS) {
  const i = process.argv.indexOf(`--${k}`)
  const next = i >= 0 ? process.argv[i + 1] : undefined
  if (next !== undefined && !next.startsWith('--') && positional.includes(next)) {
    console.error(`✗ --${k} takes no value (got "${next}")`)
    process.exit(1)
  }
}
const cmd = positional[0]
const str = (k: string, fallback?: string): string => {
  const v = flags[k]
  if (typeof v === 'string') return v
  if (fallback !== undefined) return fallback
  throw new Error(`--${k} is required`)
}
/** A whole-number flag at or above `min`; anything else stops the command. */
const num = (k: string, fallback: number, min = 1) => {
  if (flags[k] === undefined) return fallback
  const v = Number(flags[k])
  if (!Number.isInteger(v) || v < min) throw new Error(`--${k} must be a whole number of at least ${min} (got ${String(flags[k])})`)
  return v
}
const list = (k: string) => (typeof flags[k] === 'string' ? (flags[k] as string).split(',').map((s) => s.trim()).filter(Boolean) : undefined)
const log = (line: string) => console.log(line)

function panelFor(): Panel {
  const panel = typeof flags.panel === 'string' ? loadPanel(resolve(flags.panel as string)) : loadPanel()
  const pick = list('judges')
  if (!pick) return panel
  const judges = pick.map((id) => {
    const j = panel.judges.find((x) => x.id === id)
    if (!j) throw new Error(`unknown judge "${id}" — panel.json has ${panel.judges.map((x) => x.id).join(', ')}`)
    return j
  })
  return { name: `${panel.name} (subset: ${pick.join(', ')})`, judges }
}

async function main() {
  switch (cmd) {
    case 'list': {
      const tasks = selectTasks(positional[1] ?? 'all')
      for (const t of tasks) log(`${t.id.padEnd(58)} ${t.spec.track.padEnd(6)} ${String(t.spec.criteria.length).padStart(3)} criteria  ${t.spec.criteria.filter((c) => c.red_line).length} red-line  ${t.hash}`)
      log(`\n${tasks.length} tasks · ${tasks.reduce((n, t) => n + t.spec.criteria.length, 0)} criteria`)
      return
    }
    case 'validate': {
      const reports = checkAll()
      let errors = 0
      for (const r of reports) {
        for (const e of r.errors) log(`✗ ${r.id}: ${e}`)
        for (const w of r.warnings) log(`! ${r.id}: ${w}`)
        errors += r.errors.length
      }
      log(`\n${reports.length} tasks checked — ${errors} error(s), ${reports.reduce((n, r) => n + r.warnings.length, 0)} warning(s)`)
      if (errors) process.exit(1)
      return
    }
    case 'prompt': {
      const t = loadTask(positional[1] ?? str('task'))
      const { system, messages } = candidateMessages(t)
      if (system) log(`=== SYSTEM ===\n${system}\n`)
      log(`=== USER ===\n${messages[0]!.content as string}`)
      return
    }
    case 'estimate': {
      // Rough by design: 4 characters ≈ 1 token; judge calls after the first per deliverable are mostly cache reads.
      const tasks = selectTasks(str('tasks', 'packet'))
      const panel = panelFor()
      const wanted = list('candidates')
      const cands = loadCandidates().filter((c) => c.model && (!wanted || wanted.includes(c.id)))
      const attempts = num('attempts', 1)
      const catalog = (await (await fetch('https://ai-gateway.vercel.sh/v1/models')).json()) as { data: { id: string; pricing?: Record<string, string> }[] }
      const price = (m: string, k: string) => Number(catalog.data.find((x) => x.id === m)?.pricing?.[k] ?? NaN)
      const outTok = num('assume-output-tokens', 4000)
      let gen = 0
      let judge = 0
      for (const t of tasks.filter((x) => x.spec.track === 'packet')) {
        const { system, messages } = candidateMessages(t)
        const inTok = ((system?.length ?? 0) + (messages[0]!.content as string).length) / 4
        for (const c of cands) gen += attempts * (inTok * price(c.model!, 'input') + outTok * price(c.model!, 'output'))
        const prefix = (JUDGE_SYSTEM.length + (judgeMessages(t, 'x'.repeat(outTok * 4), t.spec.criteria[0]!)[0]!.content as { text: string }[])[0]!.text.length) / 4
        const n = t.spec.criteria.length
        for (const j of panel.judges) {
          // Only Anthropic judges read the cache through the gateway (measured 2026-10-10:
          // GPT-6.1 Sol writes but never reads it; Gemini on Vertex does not cache), so
          // everyone else pays full input price on every criterion.
          const cacheRead = price(j.model, 'input_cache_read')
          const repeatPrice = j.family === 'anthropic' && Number.isFinite(cacheRead) ? cacheRead : price(j.model, 'input')
          const perDeliverable = prefix * price(j.model, 'input') + (n - 1) * prefix * repeatPrice + n * (250 * price(j.model, 'input') + 600 * price(j.model, 'output'))
          judge += cands.length * attempts * perDeliverable
        }
      }
      log(`Tasks: ${tasks.length} · candidates: ${cands.map((c) => c.id).join(', ') || '(none)'} · attempts: ${attempts} · judges: ${panel.judges.map((j) => j.id).join(', ')}`)
      log(`Generation ≈ $${gen.toFixed(2)} (assuming ${outTok} output tokens per deliverable)`)
      log(`Judging    ≈ $${judge.toFixed(2)} (one call per criterion per judge; Anthropic judges read the cache after the first)`)
      log(`Total      ≈ $${(gen + judge).toFixed(2)} — reasoning tokens are not in this estimate; budget ×1.5–2 for thinking models`)
      return
    }
    case 'run': {
      assertGatewayCredentials()
      const runDir = resolveRunDir(str('run'))
      const wanted = list('candidates')
      const candidates = loadCandidates().filter((c) => !wanted || wanted.includes(c.id))
      if (wanted && candidates.length !== wanted.length) throw new Error(`unknown candidate(s): ${wanted.filter((w) => !candidates.some((c) => c.id === w)).join(', ')}`)
      const s = await runCandidates({ runDir, tasks: selectTasks(str('tasks', 'packet')), candidates, attempts: num('attempts', 1), concurrency: num('concurrency', 4), caller: gatewayCaller, log })
      log(`\nproduced ${s.produced}, skipped ${s.skipped} already on disk, failed ${s.failed.length} · generation $${s.costUsd.toFixed(2)}`)
      if (s.failed.length) process.exitCode = 1
      return
    }
    case 'import': {
      const runDir = resolveRunDir(str('run'))
      const r = importOutputs({
        runDir,
        candidate: str('candidate'),
        from: str('from'),
        tasks: selectTasks('all'),
        attempt: num('attempt', 1),
        collectedAt: typeof flags['collected-at'] === 'string' ? (flags['collected-at'] as string) : undefined,
        notes: typeof flags.notes === 'string' ? (flags.notes as string) : undefined,
        overwrite: flags.overwrite === true,
      })
      log(`imported ${r.imported.length}: ${r.imported.join(', ')}`)
      if (r.skipped.length) log(`skipped (already there; --overwrite to replace): ${r.skipped.join(', ')}`)
      if (r.unknown.length) {
        log(`✗ no such task: ${r.unknown.join(', ')}`)
        process.exitCode = 1
      }
      return
    }
    case 'grade': {
      assertGatewayCredentials()
      const runDir = resolveRunDir(str('run'))
      const panel = panelFor()
      const s = await gradeRun({ runDir, tasks: selectTasks(str('tasks', 'all')), judges: panel.judges, candidates: list('candidates'), concurrency: num('concurrency', 4), criterionConcurrency: num('criterion-concurrency', 4), caller: gatewayCaller, log, blindTerms: list('blind') })
      if (s.staleOutputs.length) log(`\n! ${s.staleOutputs.length} deliverable(s) were produced against an older version of their task: ${s.staleOutputs.join('; ')}`)
      log(`\ngraded ${s.graded}, skipped ${s.skipped} up to date · ${s.errors} criterion error(s) · judging $${s.costUsd.toFixed(2)}`)
      if (s.errors) process.exitCode = 1
      return
    }
    case 'report': {
      const name = str('run')
      const runDir = resolveRunDir(name)
      const { json, markdown } = buildReport(runDir, name, selectTasks(str('tasks', 'packet')), panelFor(), loadCandidates())
      writeJson(join(runDir, 'report.json'), json)
      writeText(join(runDir, 'report.md'), markdown)
      log(markdown)
      return
    }
    case 'calibrate': {
      const name = str('run')
      const runDir = resolveRunDir(name)
      const tasks = selectTasks(str('tasks', 'all'))
      const panel = panelFor()
      log(`staged ${stageFixtures(runDir, tasks)} fixture deliverables`)
      if (flags['report-only'] !== true) {
        assertGatewayCredentials()
        const s = await gradeRun({ runDir, tasks, judges: panel.judges, candidates: ['fixture-reference', 'fixture-flawed'], concurrency: num('concurrency', 4), criterionConcurrency: num('criterion-concurrency', 4), caller: gatewayCaller, log })
        log(`\ngraded ${s.graded}, skipped ${s.skipped} · ${s.errors} error(s) · $${s.costUsd.toFixed(2)}`)
      }
      const { json, markdown } = buildCalibration(runDir, tasks, panel)
      // One file per panel, so calibrating several panels on the same fixtures never overwrites a result.
      const stem = typeof flags.panel === 'string' ? `calibration.${panel.name}` : 'calibration'
      writeJson(join(runDir, `${stem}.json`), json)
      writeText(join(runDir, `${stem}.md`), markdown)
      log(markdown)
      return
    }
    case 'judge-export': {
      const runDirs = str('runs').split(',').map((r) => resolveRunDir(r.trim()))
      const r = exportJudging({
        runDirs,
        tasks: selectTasks(str('tasks', 'all')),
        outDir: resolve(str('out')),
        keyFile: resolve(str('key')),
        seed: flags.seed === undefined ? undefined : num('seed', 1),
        batchSize: num('batch-size', 8),
        candidates: list('candidates'),
        blindTerms: list('blind'),
      })
      log(`wrote ${r.packets} blinded packets in ${r.batches.length} batches (sizes ${r.batches.map((b) => b.length).join(', ')}) → ${resolve(str('out'))}`)
      log(`key → ${resolve(str('key'))} — keep it away from the judges`)
      return
    }
    case 'judge-import': {
      const r = importVerdicts({ verdictsDir: resolve(str('verdicts')), keyFile: resolve(str('key')), tasks: selectTasks(str('tasks', 'all')), judge: str('judge'), judgeModel: str('model') })
      log(`imported ${r.imported} verdict files`)
      if (r.missing.length) log(`! no verdicts yet for ${r.missing.length}: ${r.missing.join(', ')}`)
      for (const i of r.invalid) log(`✗ ${i.packet}: ${i.error}`)
      if (r.invalid.length || r.missing.length) process.exitCode = 1
      return
    }
    default:
      log((await Bun.file(import.meta.path).text()).split('*/')[0]!.replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, ''))
      if (cmd) process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`)
  process.exit(1)
})
