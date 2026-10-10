/**
 * End to end with a fake model: run → grade → report → resume → stale
 * rubric → judge errors → import → calibration. No network, no spend.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CandidateSpec, JudgeSpec, Panel } from '../src/config'
import { gradeRun } from '../src/grade'
import type { ModelCall, ModelCaller } from '../src/models'
import { CANDIDATE_SYSTEM, JUDGE_SYSTEM } from '../src/prompt'
import { buildCalibration, buildReport } from '../src/report'
import { gradePath, outputPath, readGrades, readOutputs } from '../src/results'
import { importOutputs, runCandidates, stageFixtures } from '../src/run'
import { loadTask, selectTasks } from '../src/tasks'

const FIXTURE_TASKS = join(import.meta.dir, 'fixtures', 'tasks')
const temps: string[] = []
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })))
const tempDir = (prefix: string) => {
  const d = mkdtempSync(join(tmpdir(), prefix))
  temps.push(d)
  return d
}

const tiny = loadTask('prospect-research/tiny-task', FIXTURE_TASKS)
const REFERENCE = tiny.fixtures!.reference
const FLAWED = tiny.fixtures!.flawed

type JudgeBehaviour = (criterion: string, deliverable: string) => 'pass' | 'fail' | 'throw'
/** Knows the right answer: the flawed memo (total $1,550) fails C-001 and C-004. */
const oracle: JudgeBehaviour = (c, d) => (d.includes('$1,550') && (c === 'C-001' || c === 'C-004') ? 'fail' : 'pass')
const lenient: JudgeBehaviour = () => 'pass'

function fakeCaller(judges: Record<string, JudgeBehaviour>) {
  const calls: ModelCall[] = []
  const caller: ModelCaller = async (call) => {
    calls.push(call)
    const usage = { finishReason: 'stop', inputTokens: 100, cachedInputTokens: 60, outputTokens: 20, latencyMs: 1 }
    if (call.system === JUDGE_SYSTEM) {
      const parts = call.messages[0]!.content as { text: string }[]
      const id = parts[1]!.text.match(/<criterion id="(C-\d{3})"/)![1]!
      const v = judges[call.model]!(id, parts[0]!.text)
      if (v === 'throw') throw new Error('provider unavailable')
      return { ...usage, text: `Checking.\n{"reasoning": "fake ${v} on ${id}", "verdict": "${v}"}`, costUsd: 0.001 }
    }
    expect(call.system).toBe(CANDIDATE_SYSTEM)
    return { ...usage, text: call.model === 'fake/good' ? REFERENCE : FLAWED, costUsd: 0.02 }
  }
  return { caller, calls }
}

const judge = (id: string, family: string): JudgeSpec => ({ id, model: `judge/${id}`, family, maxOutputTokens: 1000, external: false })
const PANEL: Panel = { name: 'test-panel', judges: [judge('a', 'anthropic'), judge('b', 'openai'), judge('c', 'google')] }
const CANDIDATES: CandidateSpec[] = [
  { id: 'good', model: 'fake/good', family: 'anthropic', label: 'Good system', maxOutputTokens: 1000 },
  { id: 'bad', model: 'fake/bad', family: 'romy', label: 'Bad system', maxOutputTokens: 1000 },
]
const BEHAVIOUR = { 'judge/a': oracle, 'judge/b': oracle, 'judge/c': lenient }

describe('run → grade → report', () => {
  const runDir = tempDir('pif-run-')
  const tasks = selectTasks('all', FIXTURE_TASKS)

  test('runs API candidates on packet tasks only, and resumes', async () => {
    const { caller, calls } = fakeCaller(BEHAVIOUR)
    const s = await runCandidates({ runDir, tasks, candidates: CANDIDATES, attempts: 1, concurrency: 2, caller })
    expect(s.produced).toBe(2) // the live task is never API-run
    expect(s.failed).toEqual([])
    expect(s.costUsd).toBeCloseTo(0.04, 10)
    expect(calls).toHaveLength(2)
    const meta = JSON.parse(readFileSync(outputPath(runDir, 'good', tiny.id, 1).replace(/\.md$/, '.meta.json'), 'utf8'))
    expect(meta).toMatchObject({ candidate: 'good', task: tiny.id, attempt: 1, promptHash: tiny.promptHash, source: 'api', model: 'fake/good' })
    const again = await runCandidates({ runDir, tasks, candidates: CANDIDATES, attempts: 1, concurrency: 2, caller })
    expect(again).toMatchObject({ produced: 0, skipped: 2 })
  })

  test('every judge grades every criterion, one call each', async () => {
    const { caller, calls } = fakeCaller(BEHAVIOUR)
    const s = await gradeRun({ runDir, tasks, judges: PANEL.judges, concurrency: 3, caller })
    expect(s.graded).toBe(6) // 2 deliverables × 3 judges
    expect(s.errors).toBe(0)
    expect(calls).toHaveLength(6 * tiny.spec.criteria.length)
    const g = JSON.parse(readFileSync(gradePath(runDir, 'a', 'bad', tiny.id, 1), 'utf8'))
    expect(g.criteria.map((c: { verdict: string }) => c.verdict)).toEqual(['fail', 'pass', 'pass', 'fail', 'pass'])
    expect(g.usage.cachedInputTokens).toBe(60 * tiny.spec.criteria.length)
  })

  test('the report scores by majority and ranks by all-pass', () => {
    const { json, markdown } = buildReport(runDir, 'test', selectTasks('packet', FIXTURE_TASKS), PANEL, CANDIDATES)
    expect(json.leaderboard.map((s) => s.candidate)).toEqual(['good', 'bad'])
    const [good, bad] = json.leaderboard
    expect(good!.all_pass.value).toBe(1)
    expect(bad!.all_pass.value).toBe(0)
    expect(bad!.criterion_pass_macro.value).toBeCloseTo(3 / 5, 10)
    expect(json.perTask[tiny.id]!.bad!.failed).toEqual(['C-001', 'C-004'])
    // The lenient judge alone would have passed the flawed memo.
    expect(bad!.by_judge.c!.all_pass).toBe(1)
    expect(json.agreement.items).toBe(10)
    expect(json.agreement.unanimous).toBeCloseTo(8 / 10, 10)
    expect(json.judgingCostUsd).toBeCloseTo(0.001 * 30, 10)
    expect(json.leaderboard[0]!.generationCostPerTask).toBeCloseTo(0.02, 10)
    expect(markdown).toContain('| 1 | Good system | **100%**')
    expect(markdown).toContain('Self-preference check')
  })

  test('re-grading skips up-to-date grades', async () => {
    const { caller, calls } = fakeCaller(BEHAVIOUR)
    const s = await gradeRun({ runDir, tasks, judges: PANEL.judges, concurrency: 3, caller })
    expect(s).toMatchObject({ graded: 0, skipped: 6 })
    expect(calls).toHaveLength(0)
  })

  test('a grade made against an edited rubric is redone, and ignored by the report until it is', async () => {
    const edited = tempDir('pif-tasks-')
    cpSync(FIXTURE_TASKS, edited, { recursive: true })
    const file = join(edited, tiny.id, 'task.json')
    const j = JSON.parse(readFileSync(file, 'utf8'))
    j.criteria[4].match_criteria = 'PASS if the memo cites documents/record.md by name. FAIL if it cites no file.'
    writeFileSync(file, JSON.stringify(j))
    const newTasks = selectTasks('all', edited)
    const before = buildReport(runDir, 'test', selectTasks('packet', edited), PANEL, CANDIDATES).json
    expect(before.staleGrades).toBe(6)
    expect(before.leaderboard).toHaveLength(0)
    expect(before.notRanked.map((n) => n.candidate)).toEqual(['bad', 'good'])
    const { caller } = fakeCaller(BEHAVIOUR)
    const s = await gradeRun({ runDir, tasks: newTasks, judges: PANEL.judges, concurrency: 3, caller })
    expect(s.graded).toBe(6)
    expect(s.staleOutputs).toHaveLength(0) // a rubric edit does not change what the system saw
    expect(buildReport(runDir, 'test', selectTasks('packet', edited), PANEL, CANDIDATES).json.leaderboard).toHaveLength(2)
  })

  test('a prompt edit (instructions or documents) does mark the deliverables stale', async () => {
    const edited = tempDir('pif-tasks-')
    cpSync(FIXTURE_TASKS, edited, { recursive: true })
    writeFileSync(join(edited, tiny.id, 'documents', 'record.md'), readFileSync(join(FIXTURE_TASKS, tiny.id, 'documents', 'record.md'), 'utf8') + '\n| 2026-01-05 | $100 | |\n')
    const { caller } = fakeCaller(BEHAVIOUR)
    const s = await gradeRun({ runDir, tasks: selectTasks('all', edited), judges: PANEL.judges, concurrency: 3, caller })
    expect(s.staleOutputs).toHaveLength(2)
  })
})

describe('judge failures', () => {
  test('a judge that keeps failing leaves the system unranked until it is re-graded — errors are never scored', async () => {
    const runDir = tempDir('pif-err-')
    const tasks = selectTasks('prospect-research', FIXTURE_TASKS)
    const { caller } = fakeCaller({ 'judge/a': oracle, 'judge/b': oracle, 'judge/c': lenient })
    await runCandidates({ runDir, tasks, candidates: [CANDIDATES[0]!], attempts: 1, concurrency: 1, caller })
    const flaky = fakeCaller({ 'judge/a': () => 'throw', 'judge/b': oracle, 'judge/c': (c) => (c === 'C-003' ? 'fail' : 'pass') })
    const s = await gradeRun({ runDir, tasks, judges: PANEL.judges, concurrency: 3, caller: flaky.caller, retries: 1, retryDelayMs: 1 })
    expect(s.errors).toBe(tiny.spec.criteria.length)
    const ga = JSON.parse(readFileSync(gradePath(runDir, 'a', 'good', tiny.id, 1), 'utf8'))
    expect(ga.criteria.every((c: { verdict: string; reasoning: string }) => c.verdict === 'error' && /provider unavailable/.test(c.reasoning))).toBe(true)
    const broken = buildReport(runDir, 'err', tasks, PANEL, CANDIDATES)
    expect(broken.json.leaderboard).toHaveLength(0)
    expect(broken.json.notRanked[0]!.incomplete[0]!.reason).toMatch(/judge error/)
    expect(broken.markdown).toContain('not ranked')
    // An errored grade is retried on the next pass; then the system is ranked on clean verdicts.
    const healed = fakeCaller(BEHAVIOUR)
    expect((await gradeRun({ runDir, tasks, judges: PANEL.judges, concurrency: 3, caller: healed.caller })).graded).toBe(1)
    const fixed = buildReport(runDir, 'err', tasks, PANEL, CANDIDATES).json
    expect(fixed.notRanked).toHaveLength(0)
    expect(fixed.leaderboard[0]!.all_pass.value).toBe(1)
  })

  test('an unparseable judge reply is retried, then recorded as an error', async () => {
    const runDir = tempDir('pif-parse-')
    const tasks = selectTasks('prospect-research', FIXTURE_TASKS)
    const { caller } = fakeCaller(BEHAVIOUR)
    await runCandidates({ runDir, tasks, candidates: [CANDIDATES[0]!], attempts: 1, concurrency: 1, caller })
    let n = 0
    const garbled: ModelCaller = async () => {
      n++
      return { text: 'It passes, I think.', finishReason: 'stop', inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, costUsd: 0, latencyMs: 1 }
    }
    const s = await gradeRun({ runDir, tasks, judges: [PANEL.judges[0]!], concurrency: 1, caller: garbled, retries: 2, retryDelayMs: 1 })
    expect(n).toBe(3 * tiny.spec.criteria.length)
    expect(s.errors).toBe(tiny.spec.criteria.length)
  })
})

describe('what a grade is tied to', () => {
  async function graded(runDir: string) {
    const tasks = selectTasks('prospect-research', FIXTURE_TASKS)
    const { caller } = fakeCaller(BEHAVIOUR)
    await runCandidates({ runDir, tasks, candidates: CANDIDATES, attempts: 1, concurrency: 2, caller })
    await gradeRun({ runDir, tasks, judges: PANEL.judges, concurrency: 3, caller })
    return tasks
  }

  test('replacing a deliverable invalidates its grades: they are redone, and never scored meanwhile', async () => {
    const runDir = tempDir('pif-text-')
    const tasks = await graded(runDir)
    // Fix the bad system's deliverable in place (an import --overwrite or a manual correction).
    writeFileSync(outputPath(runDir, 'bad', tiny.id, 1), REFERENCE)
    const meanwhile = buildReport(runDir, 't', tasks, PANEL, CANDIDATES).json
    expect(meanwhile.staleGrades).toBe(3)
    expect(meanwhile.notRanked.map((n) => n.candidate)).toEqual(['bad'])
    const { caller, calls } = fakeCaller(BEHAVIOUR)
    expect((await gradeRun({ runDir, tasks, judges: PANEL.judges, concurrency: 3, caller })).graded).toBe(3)
    expect(calls).toHaveLength(3 * tiny.spec.criteria.length)
    expect(buildReport(runDir, 't', tasks, PANEL, CANDIDATES).json.leaderboard.find((r) => r.candidate === 'bad')!.all_pass.value).toBe(1)
  })

  test('a grade from a different judge model under the same id is not used', async () => {
    const runDir = tempDir('pif-model-')
    const tasks = await graded(runDir)
    const swapped: Panel = { ...PANEL, judges: PANEL.judges.map((j) => (j.id === 'a' ? { ...j, model: 'judge/a-v2' } : j)) }
    const r = buildReport(runDir, 't', tasks, swapped, CANDIDATES).json
    expect(r.leaderboard).toHaveLength(0)
    expect(r.staleGrades).toBe(2)
  })

  test('a system with no deliverable for a task scores 0 there — skipping the hard task cannot help', async () => {
    const runDir = tempDir('pif-missing-')
    const tasks = await graded(runDir)
    rmSync(outputPath(runDir, 'bad', tiny.id, 1))
    const r = buildReport(runDir, 't', tasks, PANEL, CANDIDATES).json
    const bad = r.leaderboard.find((x) => x.candidate === 'bad')!
    expect(bad.missingTasks).toEqual([tiny.id])
    expect(bad.all_pass.value).toBe(0)
    expect(bad.criterion_pass_macro.value).toBe(0)
    expect(r.perTask[tiny.id]!.bad!.missing).toBe(true)
    expect(r.staleGrades).toBe(3) // the deleted deliverable's grades no longer count
  })

  test('a deliverable produced from an older prompt is regenerated by run, and never scored', async () => {
    const runDir = tempDir('pif-prompt-')
    await graded(runDir)
    const edited = tempDir('pif-tasks-')
    cpSync(FIXTURE_TASKS, edited, { recursive: true })
    writeFileSync(join(edited, tiny.id, 'documents', 'record.md'), `${readFileSync(join(FIXTURE_TASKS, tiny.id, 'documents', 'record.md'), 'utf8')}\n| 2026-01-05 | $100 | |\n`)
    const tasks = selectTasks('prospect-research', edited)
    const r = buildReport(runDir, 't', tasks, PANEL, CANDIDATES).json
    expect(r.leaderboard).toHaveLength(0)
    expect(r.notRanked.flatMap((n) => n.incomplete.map((i) => i.reason))).toEqual([expect.stringMatching(/older prompt/), expect.stringMatching(/older prompt/)])
    const { caller, calls } = fakeCaller(BEHAVIOUR)
    const s = await runCandidates({ runDir, tasks, candidates: CANDIDATES, attempts: 1, concurrency: 2, caller })
    expect(s.produced).toBe(2)
    expect(calls).toHaveLength(2)
  })

  test('a system whose every generation failed is ranked with 0, not dropped', async () => {
    const runDir = tempDir('pif-fail-')
    const tasks = selectTasks('prospect-research', FIXTURE_TASKS)
    const { caller } = fakeCaller(BEHAVIOUR)
    const empty: ModelCaller = async (call) => (call.model === 'fake/bad' ? { text: '', finishReason: 'length', inputTokens: 1, cachedInputTokens: 0, outputTokens: 32000, costUsd: 0, latencyMs: 1 } : caller(call))
    const s = await runCandidates({ runDir, tasks, candidates: CANDIDATES, attempts: 1, concurrency: 2, caller: empty })
    expect(s.failed).toHaveLength(1)
    await gradeRun({ runDir, tasks, judges: PANEL.judges, concurrency: 3, caller })
    const r = buildReport(runDir, 't', tasks, PANEL, CANDIDATES).json
    expect(r.leaderboard.map((x) => [x.candidate, x.all_pass.value])).toEqual([
      ['good', 1],
      ['bad', 0],
    ])
    expect(r.leaderboard[1]!.missingTasks).toEqual([tiny.id])
    // A later successful run clears the failure.
    await runCandidates({ runDir, tasks, candidates: CANDIDATES, attempts: 1, concurrency: 2, caller })
    expect(existsSync(outputPath(runDir, 'bad', tiny.id, 1).replace(/\.md$/, '.failed.json'))).toBe(false)
  })

  test('external judges are never called through the gateway', async () => {
    const runDir = tempDir('pif-ext-judge-')
    const tasks = selectTasks('prospect-research', FIXTURE_TASKS)
    const { caller, calls } = fakeCaller(BEHAVIOUR)
    await runCandidates({ runDir, tasks, candidates: [CANDIDATES[0]!], attempts: 1, concurrency: 1, caller })
    calls.length = 0
    const ext: JudgeSpec = { id: 'people', model: 'external/people', family: 'human', maxOutputTokens: 1, external: true }
    const s = await gradeRun({ runDir, tasks, judges: [ext], concurrency: 1, caller })
    expect(s.graded).toBe(0)
    expect(calls).toHaveLength(0)
  })

  test('a report never blends tracks', () => {
    expect(() => buildReport(tempDir('pif-tracks-'), 't', selectTasks('all', FIXTURE_TASKS), PANEL, CANDIDATES)).toThrow(/one track/)
  })
})

describe('import', () => {
  test('imports product outputs by task id, flat or nested, and reports unknown ids', () => {
    const runDir = tempDir('pif-imp-')
    const src = tempDir('pif-src-')
    writeFileSync(join(src, 'prospect-research__tiny-task.md'), REFERENCE)
    mkdirSync(join(src, 'live-prospects'))
    writeFileSync(join(src, 'live-prospects', 'tiny-live.md'), 'A live report.')
    writeFileSync(join(src, 'not-a-task.md'), 'x')
    const r = importOutputs({ runDir, candidate: 'romy-2026-04', from: src, tasks: selectTasks('all', FIXTURE_TASKS), attempt: 1, collectedAt: '2026-04-25', notes: 'pasted from the app' })
    expect(r.imported.sort()).toEqual(['live-prospects/tiny-live', 'prospect-research/tiny-task'])
    expect(r.unknown).toEqual(['not-a-task'])
    const outs = readOutputs(runDir)
    expect(outs).toHaveLength(2)
    expect(outs[0]!.meta).toMatchObject({ source: 'import', collectedAt: '2026-04-25', notes: 'pasted from the app' })
    const again = importOutputs({ runDir, candidate: 'romy-2026-04', from: src, tasks: selectTasks('all', FIXTURE_TASKS), attempt: 1 })
    expect(again.skipped).toHaveLength(2)
  })
})

describe('calibration', () => {
  test('measures each judge and the panel against the fixtures', async () => {
    const runDir = tempDir('pif-cal-')
    const tasks = selectTasks('all', FIXTURE_TASKS)
    expect(stageFixtures(runDir, tasks)).toBe(4)
    expect(existsSync(outputPath(runDir, 'fixture-flawed', tiny.id, 1))).toBe(true)
    // The live fixture flawed report must fail C-002, C-003, C-004; this oracle only knows the packet task, so give it one for live too.
    const liveOracle: JudgeBehaviour = (c, d) => (d.includes('$3,000,000') && ['C-002', 'C-003', 'C-004'].includes(c) ? 'fail' : oracle(c, d))
    const { caller } = fakeCaller({ 'judge/a': liveOracle, 'judge/b': liveOracle, 'judge/c': lenient })
    await gradeRun({ runDir, tasks, judges: PANEL.judges, candidates: ['fixture-reference', 'fixture-flawed'], concurrency: 4, caller })
    expect(readGrades(runDir)).toHaveLength(12)
    const { json, markdown } = buildCalibration(runDir, tasks, PANEL)
    const by = Object.fromEntries(json.judges.map((j) => [j.judge, j]))
    expect(by.a!.accuracy).toBe(1)
    expect(by.c!.false_pass).toBe(5) // C-001, C-004 on the packet task + C-002..C-004 on the live task
    expect(json.panel!.accuracy).toBe(1)
    expect(markdown).toContain('panel (majority)')
  })
})
