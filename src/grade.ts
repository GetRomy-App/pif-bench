/**
 * Grading: every judge on the panel grades every criterion of every stored
 * deliverable, one criterion per call (Harvey LAB's design: no criterion can
 * colour another's verdict, and every verdict carries its own reasoning).
 *
 * Resumable: a (judge, deliverable) pair whose grade file matches the task's
 * current hash and has no errored criteria is skipped. A grade made against
 * an older rubric is redone, never silently reused.
 */
import type { JudgeSpec } from './config'
import { mapLimit, type ModelCaller } from './models'
import { HARNESS_PROTOCOL, JUDGE_SYSTEM, judgeMessages, parseVerdict } from './prompt'
import { blind } from './redact'
import { deliverableHash, gradePath, readGrade, readOutputs, type StoredGrade, type StoredOutput, writeGrade } from './results'
import type { CriterionGrade } from './score'
import type { Task } from './tasks'

export interface GradeOptions {
  runDir: string
  tasks: Task[]
  judges: JudgeSpec[]
  caller: ModelCaller
  /** Only grade these candidates (default: every candidate with outputs). */
  candidates?: string[]
  /** Deliverables graded at once; criteria within one deliverable run `criterionConcurrency` at a time after the first warms the cache. */
  concurrency: number
  criterionConcurrency?: number
  /** Extra terms to blind (e.g. a product's own name in a house style). */
  blindTerms?: string[]
  retries?: number
  /** First retry waits this long, doubling after (default 1500 ms). */
  retryDelayMs?: number
  log?: (line: string) => void
}

export interface GradeSummary {
  graded: number
  skipped: number
  errors: number
  costUsd: number
  staleOutputs: string[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function gradeCriterion(
  caller: ModelCaller,
  judge: JudgeSpec,
  task: Task,
  deliverable: string,
  criterion: Task['spec']['criteria'][number],
  retries: number,
  retryDelayMs: number,
): Promise<{ grade: CriterionGrade; cost: number; usage: StoredGrade['usage'] }> {
  let lastError = ''
  const usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }
  let cost = 0
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await caller({
        model: judge.model,
        system: JUDGE_SYSTEM,
        messages: judgeMessages(task, deliverable, criterion),
        maxOutputTokens: judge.maxOutputTokens,
        temperature: judge.temperature,
        providerOptions: judge.providerOptions,
        tags: ['judge', judge.id],
      })
      usage.inputTokens += r.inputTokens
      usage.cachedInputTokens += r.cachedInputTokens
      usage.outputTokens += r.outputTokens
      if (Number.isFinite(r.costUsd)) cost += r.costUsd
      const v = parseVerdict(r.text)
      return { grade: { id: criterion.id, verdict: v.verdict, reasoning: v.reasoning }, cost, usage }
    } catch (e) {
      lastError = (e as Error).message
      if (attempt < retries) await sleep(retryDelayMs * 2 ** attempt)
    }
  }
  return { grade: { id: criterion.id, verdict: 'error', reasoning: `judge failed after ${retries + 1} tries: ${lastError}` }, cost, usage }
}

export async function gradeRun(opts: GradeOptions): Promise<GradeSummary> {
  const log = opts.log ?? (() => {})
  const retries = opts.retries ?? 2
  const retryDelayMs = opts.retryDelayMs ?? 1500
  const byId = new Map(opts.tasks.map((t) => [t.id, t]))
  const outputs = readOutputs(opts.runDir).filter(
    (o) => byId.has(o.task) && (!opts.candidates || opts.candidates.includes(o.candidate)),
  )
  const summary: GradeSummary = { graded: 0, skipped: 0, errors: 0, costUsd: 0, staleOutputs: [] }

  // Deliverables produced from an older prompt are not graded: re-run them (`pif run` regenerates them).
  const current = outputs.filter((o) => {
    const t = byId.get(o.task)!
    const stale = Boolean(o.meta && o.meta.promptHash !== t.promptHash)
    if (stale) summary.staleOutputs.push(`${o.candidate} · ${o.task} · a${o.attempt}`)
    return !stale
  })

  // External judges (people, or agents grading exported packets) are never called through the gateway.
  const callable = opts.judges.filter((j) => !j.external)
  for (const j of opts.judges.filter((x) => x.external)) log(`· ${j.id} is an external judge — grade it with pif judge-export / judge-import`)

  const jobs: { o: StoredOutput; t: Task; j: JudgeSpec }[] = []
  for (const o of current) {
    const t = byId.get(o.task)!
    const dHash = deliverableHash(o.text)
    for (const j of callable) {
      const prior = readGrade(gradePath(opts.runDir, j.id, o.candidate, o.task, o.attempt))
      const fresh =
        prior &&
        prior.taskHash === t.hash &&
        prior.judgeModel === j.model &&
        prior.deliverableHash === dHash &&
        prior.protocol === HARNESS_PROTOCOL &&
        prior.criteria.map((c) => c.id).join() === t.spec.criteria.map((c) => c.id).join() &&
        prior.criteria.every((c) => c.verdict !== 'error')
      if (fresh) summary.skipped++
      else jobs.push({ o, t, j })
    }
  }

  await mapLimit(jobs, opts.concurrency, async ({ o, t, j }) => {
    const deliverable = blind(o.text, opts.blindTerms)
    const [first, ...rest] = t.spec.criteria
    const head = await gradeCriterion(opts.caller, j, t, deliverable, first!, retries, retryDelayMs)
    const tail = await mapLimit(rest, opts.criterionConcurrency ?? 4, (c) => gradeCriterion(opts.caller, j, t, deliverable, c, retries, retryDelayMs))
    const all = [head, ...tail]
    const grade: StoredGrade = {
      judge: j.id,
      judgeModel: j.model,
      candidate: o.candidate,
      task: o.task,
      attempt: o.attempt,
      taskHash: t.hash,
      deliverableHash: deliverableHash(o.text),
      protocol: HARNESS_PROTOCOL,
      criteria: all.map((x) => x.grade),
      costUsd: all.reduce((s, x) => s + x.cost, 0),
      usage: all.reduce(
        (u, x) => ({
          inputTokens: u.inputTokens + x.usage.inputTokens,
          cachedInputTokens: u.cachedInputTokens + x.usage.cachedInputTokens,
          outputTokens: u.outputTokens + x.usage.outputTokens,
        }),
        { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
      ),
      gradedAt: new Date().toISOString(),
    }
    writeGrade(opts.runDir, grade)
    const errs = grade.criteria.filter((c) => c.verdict === 'error').length
    const passed = grade.criteria.filter((c) => c.verdict === 'pass').length
    summary.graded++
    summary.errors += errs
    summary.costUsd += grade.costUsd
    log(
      `${errs ? '!' : '✓'} ${j.id} → ${o.candidate} · ${o.task} · a${o.attempt}: ${passed}/${grade.criteria.length} pass${errs ? `, ${errs} ERROR` : ''} · $${grade.costUsd.toFixed(4)} · cache ${grade.usage.inputTokens ? Math.round((100 * grade.usage.cachedInputTokens) / grade.usage.inputTokens) : 0}%`,
    )
  })
  return summary
}
