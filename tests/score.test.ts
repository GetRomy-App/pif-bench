import { describe, expect, test } from 'bun:test'
import {
  type CriterionMeta,
  calibrate,
  type JudgeGrade,
  judgeAgreement,
  panelVerdict,
  scoreAttempt,
  selfPreference,
  summarizeCandidate,
  type Verdict,
} from '../src/score'

const CRITERIA: CriterionMeta[] = [
  { id: 'C-001', red_line: false },
  { id: 'C-002', red_line: true },
  { id: 'C-003', red_line: false },
]
const PANEL = ['j-anthropic', 'j-openai', 'j-google']

function grade(judge: string, verdicts: Verdict[], over: Partial<JudgeGrade> = {}): JudgeGrade {
  return {
    judge,
    candidate: 'sys',
    task: 'area/task',
    attempt: 1,
    taskHash: 'h',
    costUsd: 0,
    criteria: verdicts.map((v, i) => ({ id: `C-00${i + 1}`, verdict: v, reasoning: '' })),
    ...over,
  }
}

describe('panelVerdict', () => {
  test('passes only on a strict majority of the whole panel', () => {
    expect(panelVerdict(['pass', 'pass', 'fail'], 3)).toBe('pass')
    expect(panelVerdict(['pass', 'fail', 'fail'], 3)).toBe('fail')
    expect(panelVerdict(['pass', 'pass'], 2)).toBe('pass')
    expect(panelVerdict(['pass', 'fail'], 2)).toBe('fail') // an even split fails
    expect(panelVerdict(['pass'], 1)).toBe('pass')
  })

  test('a judge error is never a pass', () => {
    expect(panelVerdict(['pass', 'error', 'fail'], 3)).toBe('fail')
    expect(panelVerdict(['pass', 'pass', 'error'], 3)).toBe('pass')
    expect(panelVerdict(['error', 'error', 'pass'], 3)).toBe('fail')
  })
})

describe('scoreAttempt', () => {
  test('all-pass needs every criterion to pass under the panel', () => {
    const s = scoreAttempt(
      CRITERIA,
      [grade('j-anthropic', ['pass', 'pass', 'pass']), grade('j-openai', ['pass', 'pass', 'fail']), grade('j-google', ['pass', 'pass', 'pass'])],
      PANEL,
      'area',
    )
    expect(s.all_pass).toBe(true)
    expect(s.n_passed).toBe(3)
    expect(s.per_judge['j-openai']).toEqual({ n_passed: 2, all_pass: false, errors: 0 })
  })

  test('records failures and red-line failures', () => {
    const s = scoreAttempt(
      CRITERIA,
      [grade('j-anthropic', ['pass', 'fail', 'fail']), grade('j-openai', ['pass', 'fail', 'pass']), grade('j-google', ['fail', 'pass', 'fail'])],
      PANEL,
      'area',
    )
    expect(s.all_pass).toBe(false)
    expect(s.failed).toEqual(['C-002', 'C-003'])
    expect(s.red_line_failed).toEqual(['C-002'])
    expect(s.n_passed).toBe(1)
  })

  test('a missing judge counts as error votes, never as passes', () => {
    const s = scoreAttempt(CRITERIA, [grade('j-anthropic', ['pass', 'pass', 'pass'])], PANEL, 'area')
    expect(s.all_pass).toBe(false)
    expect(s.per_judge['j-google']!.errors).toBe(3)
  })
})

describe('summarizeCandidate', () => {
  const attempt = (task: string, area: string, failed: string[], attemptNo = 1, redLine: string[] = []) => ({
    candidate: 'sys',
    task,
    area,
    attempt: attemptNo,
    n_criteria: 4,
    n_passed: 4 - failed.length,
    all_pass: failed.length === 0,
    failed,
    red_line_failed: redLine,
    per_judge: { j1: { n_passed: 4 - failed.length, all_pass: failed.length === 0, errors: 0 } },
  })

  test('averages attempts within a task before averaging tasks', () => {
    const s = summarizeCandidate(
      [
        attempt('a/t1', 'a', [], 1),
        attempt('a/t1', 'a', ['C-001'], 2), // t1: all-pass 0.5, criteria 0.875
        attempt('b/t2', 'b', ['C-001', 'C-002'], 1, ['C-002']), // t2: all-pass 0, criteria 0.5
      ],
      ['j1'],
    )
    expect(s.tasks).toBe(2)
    expect(s.attempts).toBe(3)
    expect(s.all_pass.value).toBeCloseTo(0.25, 10)
    expect(s.criterion_pass_macro.value).toBeCloseTo((0.875 + 0.5) / 2, 10)
    expect(s.criterion_pass_pooled).toBeCloseTo((4 + 3 + 2) / 12, 10)
    expect(s.red_line_failure_rate).toBeCloseTo(0.5, 10)
    expect(s.by_area.a).toEqual({ tasks: 1, all_pass: 0.5, criterion_pass_macro: 0.875 })
    expect(s.by_judge.j1!.all_pass).toBeCloseTo(0.25, 10)
  })
})

describe('judgeAgreement', () => {
  test('counts unanimity and pairwise agreement over items every judge graded', () => {
    const grades = [
      grade('j-anthropic', ['pass', 'pass', 'fail']),
      grade('j-openai', ['pass', 'fail', 'fail']),
      grade('j-google', ['pass', 'pass', 'error']), // C-003 dropped: not every judge graded it
    ]
    const a = judgeAgreement(grades, PANEL)
    expect(a.items).toBe(2)
    expect(a.unanimous).toBeCloseTo(0.5, 10)
    const ao = a.pairs.find((p) => p.a === 'j-anthropic' && p.b === 'j-openai')!
    expect(ao.agreement).toBeCloseTo(0.5, 10)
    const ag = a.pairs.find((p) => p.a === 'j-anthropic' && p.b === 'j-google')!
    expect(ag.agreement).toBe(1)
  })
})

describe('selfPreference', () => {
  const summary = (candidate: string, rates: Record<string, number>) => ({
    candidate,
    tasks: 1,
    attempts: 1,
    all_pass: { value: 0, ci95: [0, 0] as [number, number] },
    criterion_pass_macro: { value: 0, ci95: [0, 0] as [number, number] },
    criterion_pass_pooled: 0,
    red_line_failure_rate: 0,
    by_area: {},
    by_judge: Object.fromEntries(Object.entries(rates).map(([j, r]) => [j, { all_pass: 0, criterion_pass_macro: r }])),
  })
  const families: Record<string, string> = { 'j-anthropic': 'anthropic', 'j-openai': 'openai', claude: 'anthropic', gpt: 'openai', romy: 'romy' }

  test('isolates a judge that favours its own family, and does not blame the neutral judge for it', () => {
    const out = selfPreference(
      [
        summary('claude', { 'j-anthropic': 0.9, 'j-openai': 0.7 }), // the anthropic judge is +0.2 on its own
        summary('gpt', { 'j-anthropic': 0.6, 'j-openai': 0.6 }),
        summary('romy', { 'j-anthropic': 0.8, 'j-openai': 0.8 }), // neutral: no judge of its family
      ],
      ['j-anthropic', 'j-openai'],
      (id) => families[id],
    )
    const anth = out.find((o) => o.judge === 'j-anthropic')!
    expect(anth.candidate).toBe('claude')
    expect(anth.lift_on_own).toBeCloseTo(0.2, 10)
    expect(anth.mean_lift_on_neutral).toBeCloseTo(0, 10)
    expect(anth.self_preference).toBeCloseTo(0.2, 10)
    const oai = out.find((o) => o.judge === 'j-openai')!
    expect(oai.candidate).toBe('gpt')
    expect(oai.self_preference).toBeCloseTo(0, 10) // unbiased, and reported as such
  })

  test('is not computed without a neutral system or an outside judge', () => {
    expect(selfPreference([summary('claude', { 'j-anthropic': 0.9, 'j-openai': 0.7 }), summary('gpt', { 'j-anthropic': 0.6, 'j-openai': 0.6 })], ['j-anthropic', 'j-openai'], (id) => families[id])).toEqual([])
    expect(selfPreference([summary('claude', { 'j-anthropic': 0.9 }), summary('romy', { 'j-anthropic': 0.8 })], ['j-anthropic'], (id) => families[id])).toEqual([])
  })
})

describe('calibrate', () => {
  test('scores judges against planted errors and separates false passes from false fails', () => {
    const expectedFail = (_task: string, fixture: 'reference' | 'flawed') => new Set(fixture === 'flawed' ? ['C-002'] : [])
    const out = calibrate(
      [
        grade('good', ['pass', 'pass', 'pass'], { candidate: 'fixture:reference' }),
        grade('good', ['pass', 'fail', 'pass'], { candidate: 'fixture:flawed' }),
        grade('lenient', ['pass', 'pass', 'pass'], { candidate: 'fixture:reference' }),
        grade('lenient', ['pass', 'pass', 'pass'], { candidate: 'fixture:flawed' }),
        grade('harsh', ['fail', 'pass', 'pass'], { candidate: 'fixture:reference' }),
        grade('harsh', ['pass', 'fail', 'error'], { candidate: 'fixture:flawed' }),
      ],
      expectedFail,
    )
    const by = Object.fromEntries(out.map((r) => [r.judge, r]))
    expect(by.good!.accuracy).toBe(1)
    expect(by.lenient!.false_pass).toBe(1)
    expect(by.lenient!.false_fail).toBe(0)
    expect(by.harsh!.false_fail).toBe(1) // the wrong fail
    expect(by.harsh!.errors).toBe(1) // the missing verdict, counted apart
    expect(by.harsh!.accuracy).toBeCloseTo(4 / 6, 10)
  })
})
