/**
 * Scoring. Pure functions over judge grades — no I/O, no model calls — so
 * every number in a report can be recomputed and unit-tested.
 *
 *   criterion  pass/fail per judge → the PANEL verdict is pass only when a
 *              strict majority of the whole panel says pass (a judge error is
 *              never a pass; with an even panel a tie fails).
 *   task       ALL-PASS: 1 if every criterion passed under the panel, else 0
 *              — Harvey LAB's headline. Criterion pass fraction is the
 *              diagnostic.
 *   candidate  each task's value is averaged over its attempts first, then
 *              over tasks, so every task weighs the same however many
 *              criteria or attempts it has. Intervals are a bootstrap over
 *              tasks.
 */
import { bootstrapMeanCI, cohenKappa, fleissKappa, mean, wilsonCI } from './stats'

export type Verdict = 'pass' | 'fail' | 'error'

export interface CriterionGrade {
  id: string
  verdict: Verdict
  reasoning: string
}

/** One judge's grades for one deliverable. */
export interface JudgeGrade {
  judge: string
  candidate: string
  task: string
  attempt: number
  taskHash: string
  criteria: CriterionGrade[]
  costUsd: number
}

export interface CriterionMeta {
  id: string
  red_line: boolean
}

export interface AttemptScore {
  candidate: string
  task: string
  area: string
  attempt: number
  n_criteria: number
  n_passed: number
  all_pass: boolean
  failed: string[]
  red_line_failed: string[]
  per_judge: Record<string, { n_passed: number; all_pass: boolean; errors: number }>
  /** No deliverable at all (a failed or skipped generation): scored as every criterion failed. */
  missing?: boolean
}

/** The score of a deliverable that does not exist: it met no criterion. Missing work is a failure, not an absence. */
export function missingAttempt(candidate: string, task: string, area: string, attempt: number, criteria: CriterionMeta[], panel: string[]): AttemptScore {
  return {
    candidate,
    task,
    area,
    attempt,
    n_criteria: criteria.length,
    n_passed: 0,
    all_pass: false,
    failed: criteria.map((c) => c.id),
    red_line_failed: [],
    per_judge: Object.fromEntries(panel.map((j) => [j, { n_passed: 0, all_pass: false, errors: 0 }])),
    missing: true,
  }
}

export function panelVerdict(verdicts: Verdict[], panelSize: number): 'pass' | 'fail' {
  const passes = verdicts.filter((v) => v === 'pass').length
  return passes > panelSize / 2 ? 'pass' : 'fail'
}

/** Score one attempt of one candidate on one task from every judge's grades. */
export function scoreAttempt(criteria: CriterionMeta[], grades: JudgeGrade[], panel: string[], area: string): AttemptScore {
  if (!grades.length) throw new Error('scoreAttempt: no grades')
  const { candidate, task, attempt } = grades[0]!
  const byJudge = new Map(grades.map((g) => [g.judge, new Map(g.criteria.map((c) => [c.id, c.verdict]))]))
  const failed: string[] = []
  const redLineFailed: string[] = []
  for (const c of criteria) {
    const votes = panel.map((j) => byJudge.get(j)?.get(c.id) ?? 'error')
    if (panelVerdict(votes, panel.length) === 'fail') {
      failed.push(c.id)
      if (c.red_line) redLineFailed.push(c.id)
    }
  }
  const per_judge: AttemptScore['per_judge'] = {}
  for (const j of panel) {
    const v = byJudge.get(j)
    const verdicts = criteria.map((c) => v?.get(c.id) ?? 'error')
    const n_passed = verdicts.filter((x) => x === 'pass').length
    per_judge[j] = { n_passed, all_pass: n_passed === criteria.length, errors: verdicts.filter((x) => x === 'error').length }
  }
  return {
    candidate,
    task,
    area,
    attempt,
    n_criteria: criteria.length,
    n_passed: criteria.length - failed.length,
    all_pass: failed.length === 0,
    failed,
    red_line_failed: redLineFailed,
    per_judge,
  }
}

export interface Rate {
  value: number
  ci95: [number, number]
}

export interface CandidateSummary {
  candidate: string
  tasks: number
  attempts: number
  all_pass: Rate
  criterion_pass_macro: Rate
  criterion_pass_pooled: number
  red_line_failure_rate: number
  by_area: Record<string, { tasks: number; all_pass: number; criterion_pass_macro: number }>
  by_judge: Record<string, { all_pass: number; criterion_pass_macro: number }>
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    const arr = m.get(k)
    if (arr) arr.push(x)
    else m.set(k, [x])
  }
  return m
}

/** Per-task values for one candidate: each metric averaged over that task's attempts. */
function perTask(scores: AttemptScore[]) {
  // Sorted by task id, so the bootstrap resamples the same sequence however the grade files were listed.
  return [...groupBy(scores, (s) => s.task).values()].sort((a, b) => a[0]!.task.localeCompare(b[0]!.task)).map((attempts) => ({
    task: attempts[0]!.task,
    area: attempts[0]!.area,
    all_pass: mean(attempts.map((a) => (a.all_pass ? 1 : 0))),
    criterion_pass: mean(attempts.map((a) => a.n_passed / a.n_criteria)),
    red_line: mean(attempts.map((a) => (a.red_line_failed.length ? 1 : 0))),
    attempts,
  }))
}

export function summarizeCandidate(scores: AttemptScore[], panel: string[]): CandidateSummary {
  if (!scores.length) throw new Error('summarizeCandidate: no scores')
  const tasks = perTask(scores)
  const allPass = tasks.map((t) => t.all_pass)
  const macro = tasks.map((t) => t.criterion_pass)
  const by_area: CandidateSummary['by_area'] = {}
  for (const [area, ts] of groupBy(tasks, (t) => t.area)) {
    by_area[area] = { tasks: ts.length, all_pass: mean(ts.map((t) => t.all_pass)), criterion_pass_macro: mean(ts.map((t) => t.criterion_pass)) }
  }
  const by_judge: CandidateSummary['by_judge'] = {}
  for (const j of panel) {
    const jt = tasks.map((t) => ({
      all_pass: mean(t.attempts.map((a) => (a.per_judge[j]?.all_pass ? 1 : 0))),
      crit: mean(t.attempts.map((a) => (a.per_judge[j]?.n_passed ?? 0) / a.n_criteria)),
    }))
    by_judge[j] = { all_pass: mean(jt.map((x) => x.all_pass)), criterion_pass_macro: mean(jt.map((x) => x.crit)) }
  }
  const passed = scores.reduce((n, s) => n + s.n_passed, 0)
  const total = scores.reduce((n, s) => n + s.n_criteria, 0)
  return {
    candidate: scores[0]!.candidate,
    tasks: tasks.length,
    attempts: scores.length,
    all_pass: {
      value: mean(allPass),
      ci95: allPass.every((v) => v === 0 || v === 1) ? wilsonCI(allPass.filter((v) => v === 1).length, allPass.length) : bootstrapMeanCI(allPass),
    },
    criterion_pass_macro: { value: mean(macro), ci95: bootstrapMeanCI(macro) },
    criterion_pass_pooled: passed / total,
    red_line_failure_rate: mean(tasks.map((t) => t.red_line)),
    by_area,
    by_judge,
  }
}

export interface Agreement {
  items: number
  /** Share of items where every judge gave the same verdict. */
  unanimous: number
  fleiss_kappa: number
  pairs: { a: string; b: string; agreement: number; cohen_kappa: number }[]
}

/**
 * Inter-judge agreement over every (deliverable, criterion) that all judges
 * graded without error.
 */
export function judgeAgreement(grades: JudgeGrade[], panel: string[]): Agreement {
  const items = new Map<string, Map<string, boolean>>()
  for (const g of grades) {
    if (!panel.includes(g.judge)) continue
    for (const c of g.criteria) {
      if (c.verdict === 'error') continue
      const key = `${g.candidate}\0${g.task}\0${g.attempt}\0${c.id}`
      let m = items.get(key)
      if (!m) items.set(key, (m = new Map()))
      m.set(g.judge, c.verdict === 'pass')
    }
  }
  const complete = [...items.values()].filter((m) => panel.every((j) => m.has(j))).map((m) => panel.map((j) => m.get(j)!))
  const pairs: Agreement['pairs'] = []
  for (let i = 0; i < panel.length; i++) {
    for (let k = i + 1; k < panel.length; k++) {
      const a = complete.map((r) => r[i]!)
      const b = complete.map((r) => r[k]!)
      pairs.push({ a: panel[i]!, b: panel[k]!, agreement: mean(a.map((x, n) => (x === b[n] ? 1 : 0))), cohen_kappa: cohenKappa(a, b) })
    }
  }
  return {
    items: complete.length,
    unanimous: mean(complete.map((r) => (r.every((x) => x === r[0]) ? 1 : 0))),
    fleiss_kappa: panel.length >= 2 && complete.length ? fleissKappa(complete) : NaN,
    pairs,
  }
}

/**
 * Self-preference check. For judge J (family F) and a candidate C of family F,
 * `lift_on_own` is J's criterion pass rate on C minus the mean rate the
 * judges from OTHER families give C. The same lift is computed on neutral
 * candidates — systems whose family has no judge on the panel — where J has
 * no stake; `self_preference` is the own lift minus the mean neutral lift. A
 * biased judge cannot inflate a neutral judge's score this way, because the
 * baseline never includes a same-family judge. With no neutral candidate, or
 * no judge outside F, it is not computed.
 */
export function selfPreference(
  summaries: CandidateSummary[],
  panel: string[],
  familyOf: (id: string) => string | undefined,
): { judge: string; candidate: string; lift_on_own: number; mean_lift_on_neutral: number; self_preference: number }[] {
  const judgeFamilies = new Set(panel.map(familyOf))
  const neutral = summaries.filter((s) => !judgeFamilies.has(familyOf(s.candidate)))
  const out = []
  for (const j of panel) {
    const fam = familyOf(j)
    if (!fam) continue
    const outsiders = panel.filter((o) => familyOf(o) !== fam)
    if (!outsiders.length || !neutral.length) continue
    const lift = (s: CandidateSummary) => s.by_judge[j]!.criterion_pass_macro - mean(outsiders.map((o) => s.by_judge[o]!.criterion_pass_macro))
    const neutralLift = mean(neutral.map(lift))
    for (const own of summaries.filter((s) => familyOf(s.candidate) === fam)) {
      const onOwn = lift(own)
      out.push({ judge: j, candidate: own.candidate, lift_on_own: onOwn, mean_lift_on_neutral: neutralLift, self_preference: onOwn - neutralLift })
    }
  }
  return out
}

export interface CalibrationResult {
  judge: string
  items: number
  accuracy: number
  /** Criteria the fixture was built to FAIL that the judge passed — the dangerous direction. */
  false_pass: number
  /** Criteria the fixture was built to PASS that the judge failed. */
  false_fail: number
  /** Verdicts the judge did not return (errors) — counted apart from false passes and fails. */
  errors: number
  misses: { task: string; fixture: 'reference' | 'flawed'; criterion: string; expected: 'pass' | 'fail'; got: Verdict }[]
}

/**
 * Judge accuracy on the fixtures: every task's reference deliverable must
 * pass every criterion; its flawed deliverable must fail exactly the listed
 * ones. `grades` here have candidate `fixture:reference` / `fixture:flawed`.
 */
export function calibrate(
  grades: JudgeGrade[],
  expectedFail: (task: string, fixture: 'reference' | 'flawed') => Set<string>,
): CalibrationResult[] {
  const byJudge = groupBy(grades, (g) => g.judge)
  const out: CalibrationResult[] = []
  for (const [judge, gs] of byJudge) {
    let items = 0
    let correct = 0
    let falsePass = 0
    let falseFail = 0
    let errors = 0
    const misses: CalibrationResult['misses'] = []
    for (const g of gs) {
      const fixture = g.candidate.replace(/^fixture:/, '') as 'reference' | 'flawed'
      const fail = expectedFail(g.task, fixture)
      for (const c of g.criteria) {
        items++
        const expected = fail.has(c.id) ? 'fail' : 'pass'
        if (c.verdict === expected) correct++
        else {
          if (c.verdict === 'error') errors++
          else if (expected === 'fail') falsePass++
          else falseFail++
          misses.push({ task: g.task, fixture, criterion: c.id, expected, got: c.verdict })
        }
      }
    }
    out.push({ judge, items, accuracy: items ? correct / items : NaN, false_pass: falsePass, false_fail: falseFail, errors, misses })
  }
  return out.sort((a, b) => a.judge.localeCompare(b.judge))
}
