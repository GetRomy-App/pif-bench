/**
 * Reports. Everything here is recomputed from the stored grades, so anyone
 * holding a run directory can rebuild — and check — every number.
 */
import type { CandidateSpec, Panel } from './config'
import { EXTERNAL_PROTOCOL } from './external'
import { HARNESS_PROTOCOL } from './prompt'
import { deliverableHash, readFailures, readGrades, readOutputs, type StoredGrade } from './results'
import {
  type AttemptScore,
  type CalibrationResult,
  type CandidateSummary,
  calibrate,
  type JudgeGrade,
  judgeAgreement,
  missingAttempt,
  panelVerdict,
  scoreAttempt,
  selfPreference,
  summarizeCandidate,
} from './score'
import { mean } from './stats'
import type { Task } from './tasks'

const isFixture = (c: string) => c.startsWith('fixture-')
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—')
const ci = ([lo, hi]: [number, number]) => (Number.isFinite(lo) ? `${Math.round(lo * 100)}–${Math.round(hi * 100)}` : '—')
const usd = (x: number) => (Number.isFinite(x) ? `$${x < 0.1 ? x.toFixed(3) : x.toFixed(2)}` : '—')

interface Incomplete {
  candidate: string
  task: string
  attempt: number
  reason: string
}

interface Loaded {
  /** Grades that match the current rubric, judge model, deliverable text and grading protocol. */
  current: StoredGrade[]
  stale: number
  attempts: AttemptScore[]
  incomplete: Incomplete[]
}

/**
 * Score every stored deliverable of the selected tasks. A deliverable is
 * scored only when every panel judge has a current grade for it with no
 * judge error; otherwise it is reported as incomplete, never silently scored.
 */
function load(runDir: string, tasks: Task[], panel: Panel): Loaded {
  const judges = new Map(panel.judges.map((j) => [j.id, j]))
  const judgeIds = panel.judges.map((j) => j.id)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const key = (c: string, t: string, a: number) => `${c}\0${t}\0${a}`
  const outputs = readOutputs(runDir).filter((o) => byId.has(o.task))
  const outHash = new Map(outputs.map((o) => [key(o.candidate, o.task, o.attempt), deliverableHash(o.text)]))
  const all = readGrades(runDir).filter((g) => byId.has(g.task) && judges.has(g.judge))
  const current = all.filter((g) => {
    const j = judges.get(g.judge)!
    return (
      g.taskHash === byId.get(g.task)!.hash &&
      g.judgeModel === j.model &&
      g.deliverableHash !== undefined &&
      g.deliverableHash === outHash.get(key(g.candidate, g.task, g.attempt)) &&
      g.protocol === (j.external ? EXTERNAL_PROTOCOL : HARNESS_PROTOCOL)
    )
  })
  const groups = new Map<string, StoredGrade[]>()
  for (const g of current) {
    const k = key(g.candidate, g.task, g.attempt)
    groups.set(k, [...(groups.get(k) ?? []), g])
  }
  const attempts: AttemptScore[] = []
  const incomplete: Incomplete[] = []
  for (const o of outputs) {
    const t = byId.get(o.task)!
    const base = { candidate: o.candidate, task: o.task, attempt: o.attempt }
    if (o.meta && o.meta.promptHash !== t.promptHash) {
      incomplete.push({ ...base, reason: 'produced from an older prompt — re-run it' })
      continue
    }
    const gs = groups.get(key(o.candidate, o.task, o.attempt)) ?? []
    const missingJudges = judgeIds.filter((j) => !gs.some((g) => g.judge === j))
    if (missingJudges.length) {
      incomplete.push({ ...base, reason: `no current grade from ${missingJudges.join(', ')}` })
      continue
    }
    const errors = gs.reduce((n, g) => n + g.criteria.filter((c) => c.verdict === 'error').length, 0)
    if (errors) {
      incomplete.push({ ...base, reason: `${errors} judge error(s) — re-run pif grade` })
      continue
    }
    attempts.push(scoreAttempt(t.spec.criteria, gs, judgeIds, t.area))
  }
  return { current, stale: all.length - current.length, attempts, incomplete }
}

export interface ReportJson {
  run: string
  generatedAt: string
  panel: Panel
  track: string
  tasks: { id: string; area: string; track: string; hash: string; criteria: number }[]
  /** Selected tasks no system has a deliverable for — left out of every score. */
  tasksNotRun: string[]
  leaderboard: (CandidateSummary & { label: string; family?: string; generationCostPerTask: number | null; missingTasks: string[] })[]
  /** Systems with ungraded, errored or stale work: not ranked until it is fixed. */
  notRanked: { candidate: string; label: string; incomplete: Incomplete[] }[]
  perTask: Record<string, Record<string, { passed: number; total: number; all_pass: number; failed: string[]; missing: boolean }>>
  agreement: ReturnType<typeof judgeAgreement>
  selfPreference: ReturnType<typeof selfPreference>
  judgingCostUsd: number
  staleGrades: number
}

export function buildReport(runDir: string, runName: string, tasks: Task[], panel: Panel, candidates: CandidateSpec[]): { json: ReportJson; markdown: string } {
  const tracks = [...new Set(tasks.map((t) => t.spec.track))]
  if (tracks.length > 1) throw new Error('A report covers one track — run it for --tasks packet or --tasks live, never both blended')
  const { current, stale, attempts, incomplete } = load(runDir, tasks, panel)
  const judgeIds = panel.judges.map((j) => j.id)
  const spec = new Map(candidates.map((c) => [c.id, c]))
  const label = (c: string) => spec.get(c)?.label ?? c
  const selected = (task: string) => tasks.some((t) => t.id === task)
  const outputs = readOutputs(runDir).filter((o) => !isFixture(o.candidate) && selected(o.task))
  const failures = readFailures(runDir).filter((f) => !isFixture(f.candidate) && selected(f.task))
  const graded = readGrades(runDir).filter((g) => !isFixture(g.candidate) && selected(g.task))
  // A system counts if it produced, failed to produce, or was graded on anything: a system whose every generation failed still scores 0, not nothing.
  const systems = [...new Set([...outputs, ...failures, ...graded].map((x) => x.candidate))].sort()
  // Every system is scored on the same tasks: any task some system attempted. A system with no deliverable for one of them scores 0 there.
  const scored = tasks.filter((t) => [...outputs, ...failures].some((o) => o.task === t.id))
  const tasksNotRun = tasks.filter((t) => !scored.includes(t)).map((t) => t.id)

  const notRanked: ReportJson['notRanked'] = []
  const ranked: { summary: CandidateSummary; missingTasks: string[]; attempts: AttemptScore[] }[] = []
  for (const c of systems) {
    const inc = incomplete.filter((i) => i.candidate === c)
    if (inc.length) {
      notRanked.push({ candidate: c, label: label(c), incomplete: inc })
      continue
    }
    const mine = attempts.filter((a) => a.candidate === c)
    const missingTasks: string[] = []
    for (const t of scored) {
      if (!mine.some((a) => a.task === t.id)) {
        missingTasks.push(t.id)
        mine.push(missingAttempt(c, t.id, t.area, 1, t.spec.criteria, judgeIds))
      }
    }
    ranked.push({ summary: summarizeCandidate(mine, judgeIds), missingTasks, attempts: mine })
  }
  ranked.sort((a, b) => b.summary.all_pass.value - a.summary.all_pass.value || b.summary.criterion_pass_macro.value - a.summary.criterion_pass_macro.value || a.summary.candidate.localeCompare(b.summary.candidate))

  const familyOf = (id: string) => panel.judges.find((j) => j.id === id)?.family ?? spec.get(id)?.family
  const leaderboard = ranked.map(({ summary: s, missingTasks }) => {
    const costs = outputs.filter((o) => o.candidate === s.candidate && Number.isFinite(o.meta?.costUsd)).map((o) => o.meta!.costUsd!)
    return { ...s, label: label(s.candidate), family: spec.get(s.candidate)?.family, generationCostPerTask: costs.length ? mean(costs) : null, missingTasks }
  })

  const perTask: ReportJson['perTask'] = {}
  for (const t of scored) {
    perTask[t.id] = {}
    for (const r of ranked) {
      const as = r.attempts.filter((a) => a.task === t.id)
      perTask[t.id]![r.summary.candidate] = {
        passed: mean(as.map((a) => a.n_passed)),
        total: t.spec.criteria.length,
        all_pass: mean(as.map((a) => (a.all_pass ? 1 : 0))),
        failed: [...new Set(as.flatMap((a) => a.failed))],
        missing: as.every((a) => a.missing),
      }
    }
  }

  const realGrades = current.filter((g) => !isFixture(g.candidate))
  const json: ReportJson = {
    run: runName,
    generatedAt: new Date().toISOString(),
    panel,
    track: tracks[0] ?? '',
    tasks: scored.map((t) => ({ id: t.id, area: t.area, track: t.spec.track, hash: t.hash, criteria: t.spec.criteria.length })),
    tasksNotRun,
    leaderboard,
    notRanked,
    perTask,
    agreement: judgeAgreement(realGrades, judgeIds),
    selfPreference: selfPreference(ranked.map((r) => r.summary), judgeIds, familyOf),
    judgingCostUsd: current.reduce((s, g) => s + (g.costUsd || 0), 0),
    staleGrades: stale,
  }
  return { json, markdown: renderMarkdown(json, scored) }
}

function renderMarkdown(r: ReportJson, tasks: Task[]): string {
  const L: string[] = []
  const areas = [...new Set(tasks.map((t) => t.area))]
  const tracks = [...new Set(tasks.map((t) => t.spec.track))]
  const attemptsPerTask = r.leaderboard.length ? Math.max(...r.leaderboard.map((s) => Math.round(s.attempts / Math.max(1, s.tasks)))) : 0
  L.push(`# PIF-Bench v2 — ${r.run}`, '')
  L.push(`- **Track:** ${r.track} · **Tasks scored:** ${tasks.length} (${areas.length} area${areas.length === 1 ? '' : 's'}: ${areas.join(', ')}) · ${tasks.reduce((n, t) => n + t.spec.criteria.length, 0)} criteria`)
  if (r.tasksNotRun.length) L.push(`- **Not run by any system (left out):** ${r.tasksNotRun.join(', ')}`)
  L.push(`- **Judges:** ${r.panel.judges.map((j) => `\`${j.model}\``).join(', ')} — panel \`${r.panel.name}\`${r.panel.judges.length > 1 ? '; a criterion passes on a strict majority' : ''}`)
  L.push(`- **Attempts per task:** ${attemptsPerTask || '—'} · **Judging cost:** ${usd(r.judgingCostUsd)}`)
  if (r.staleGrades) L.push(`- ⚠️ ${r.staleGrades} grade file(s) no longer match the current rubric, judge, deliverable or grading protocol and are ignored — re-run the grading.`)
  if (r.notRanked.length) L.push(`- ⚠️ **${r.notRanked.length} system(s) not ranked** because some of their work is ungraded, has judge errors or was produced from an older prompt — see the end of this report.`)
  L.push('')
  L.push('## Leaderboard', '')
  L.push('**All-pass** is the share of tasks where the deliverable met *every* criterion — the headline, as in Harvey LAB. **Criteria met** averages each task\'s pass fraction. **Red-line** is the share of tasks with at least one failure tagged as harmful to a donor relationship or the organization. The all-pass interval is a 95% Wilson interval; the criteria-met interval is a 95% bootstrap over tasks.', '')
  L.push('| # | System | All-pass | 95% CI | Criteria met | 95% CI | Red-line failures | Tasks | Cost / task |')
  L.push('|---|---|---|---|---|---|---|---|---|')
  // Systems whose printed all-pass and criteria-met figures are identical share a rank ("1="): an order set by
  // a fourth decimal place is not a ranking.
  const shown = (s: (typeof r.leaderboard)[number]) => `${pct(s.all_pass.value)}|${pct(s.criterion_pass_macro.value)}`
  const rankOf = (i: number) => {
    const first = r.leaderboard.findIndex((x) => shown(x) === shown(r.leaderboard[i]!))
    const tied = r.leaderboard.filter((x) => shown(x) === shown(r.leaderboard[i]!)).length > 1
    return `${first + 1}${tied ? '=' : ''}`
  }
  r.leaderboard.forEach((s, i) => {
    L.push(`| ${rankOf(i)} | ${s.label} | **${pct(s.all_pass.value)}** | ${ci(s.all_pass.ci95)} | ${pct(s.criterion_pass_macro.value)} | ${ci(s.criterion_pass_macro.ci95)} | ${pct(s.red_line_failure_rate)} | ${s.tasks} | ${s.generationCostPerTask === null ? '—' : usd(s.generationCostPerTask)} |`)
  })
  const missingAny = r.leaderboard.filter((s) => s.missingTasks.length)
  if (missingAny.length) L.push('', `> A system with no deliverable for a task scores 0 on it: ${missingAny.map((s) => `${s.label} (${s.missingTasks.length}: ${s.missingTasks.join(', ')})`).join('; ')}.`)
  L.push('')

  if (areas.length > 1) {
    L.push('## By area', '', 'All-pass · criteria met.', '')
    L.push(`| System | ${areas.join(' | ')} |`)
    L.push(`|---|${areas.map(() => '---').join('|')}|`)
    for (const s of r.leaderboard) L.push(`| ${s.label} | ${areas.map((a) => (s.by_area[a] ? `${pct(s.by_area[a]!.all_pass)} · ${pct(s.by_area[a]!.criterion_pass_macro)}` : '—')).join(' | ')} |`)
    L.push('')
  }

  L.push('## Per task', '', 'Criteria met / total; ✅ = all-pass. Failed criterion ids in brackets.', '')
  L.push(`| Task | ${r.leaderboard.map((s) => s.label).join(' | ')} |`)
  L.push(`|---|${r.leaderboard.map(() => '---').join('|')}|`)
  for (const t of tasks) {
    const row = r.leaderboard.map((s) => {
      const c = r.perTask[t.id]?.[s.candidate]
      if (!c) return '—'
      if (c.missing) return `missing (0/${c.total})`
      const n = Number.isInteger(c.passed) ? String(c.passed) : c.passed.toFixed(1)
      return `${c.all_pass === 1 ? '✅ ' : ''}${n}/${c.total}${c.failed.length ? ` [${c.failed.map((x) => x.replace('C-', '')).join(',')}]` : ''}`
    })
    L.push(`| ${t.id} | ${row.join(' | ')} |`)
  }
  L.push('')

  const crit = new Map<string, { task: string; id: string; title: string; red: boolean; missedBy: string[] }>()
  for (const t of tasks) {
    for (const c of t.spec.criteria) {
      const missedBy = r.leaderboard.filter((s) => !r.perTask[t.id]?.[s.candidate]?.missing && r.perTask[t.id]?.[s.candidate]?.failed.includes(c.id)).map((s) => s.label)
      if (missedBy.length) crit.set(`${t.id}/${c.id}`, { task: t.id, id: c.id, title: c.title, red: c.red_line, missedBy })
    }
  }
  const missed = [...crit.values()].sort((a, b) => b.missedBy.length - a.missedBy.length || a.task.localeCompare(b.task)).slice(0, 15)
  if (missed.length) {
    L.push('## Most-missed criteria', '')
    L.push('| Task | Criterion | Missed by |')
    L.push('|---|---|---|')
    for (const m of missed) L.push(`| ${m.task} | ${m.id}${m.red ? ' 🔴' : ''} — ${m.title} | ${m.missedBy.join(', ')} |`)
    L.push('', '🔴 = red-line criterion.', '')
  }

  L.push('## Judges', '')
  const a = r.agreement
  L.push(`Across ${a.items} criterion verdicts every judge returned: unanimous on **${pct(a.unanimous)}**, Fleiss' κ = **${Number.isFinite(a.fleiss_kappa) ? a.fleiss_kappa.toFixed(2) : '—'}**.`, '')
  if (a.pairs.length) {
    L.push('| Judge pair | Agreement | Cohen\'s κ |', '|---|---|---|')
    for (const p of a.pairs) L.push(`| ${p.a} × ${p.b} | ${pct(p.agreement)} | ${Number.isFinite(p.cohen_kappa) ? p.cohen_kappa.toFixed(2) : '—'} |`)
    L.push('')
  }
  if (r.leaderboard.length && r.panel.judges.length > 1) {
    L.push('Each judge alone (all-pass · criteria met):', '')
    L.push(`| System | ${r.panel.judges.map((j) => j.id).join(' | ')} |`)
    L.push(`|---|${r.panel.judges.map(() => '---').join('|')}|`)
    for (const s of r.leaderboard) L.push(`| ${s.label} | ${r.panel.judges.map((j) => `${pct(s.by_judge[j.id]!.all_pass)} · ${pct(s.by_judge[j.id]!.criterion_pass_macro)}`).join(' | ')} |`)
    L.push('')
  }
  if (r.selfPreference.length) {
    L.push("**Self-preference check.** How much more a judge passes its own family's system than the judges from other families do, minus the same lift on neutral systems (families with no judge on the panel). Near zero means no measurable favouritism.", '')
    L.push('| Judge | Own-family system | Lift on own | Mean lift on neutral systems | Self-preference |', '|---|---|---|---|---|')
    const pp = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pts`
    for (const s of r.selfPreference) L.push(`| ${s.judge} | ${s.candidate} | ${pp(s.lift_on_own)} | ${pp(s.mean_lift_on_neutral)} | **${pp(s.self_preference)}** |`)
    L.push('')
  } else if (r.panel.judges.length === 1) {
    L.push('With a single judge, agreement and self-preference cannot be measured from this run; see the calibration report for the judge\'s accuracy on known answers.', '')
  }
  if (r.notRanked.length) {
    L.push('## Not ranked', '')
    for (const n of r.notRanked) {
      L.push(`- **${n.label}** — ${n.incomplete.length} deliverable(s): ${n.incomplete.slice(0, 6).map((i) => `${i.task} a${i.attempt} (${i.reason})`).join('; ')}${n.incomplete.length > 6 ? '; …' : ''}`)
    }
    L.push('')
  }
  return `${L.join('\n')}\n`
}

export interface CalibrationReport {
  judges: CalibrationResult[]
  panel: CalibrationResult | null
}

/** Judge accuracy on every task's fixtures, for each judge alone and for the panel's majority verdict. */
export function buildCalibration(runDir: string, tasks: Task[], panel: Panel): { json: CalibrationReport; markdown: string } {
  const { current } = load(runDir, tasks, panel)
  const judgeIds = panel.judges.map((j) => j.id)
  const fixtures = current.filter((g) => isFixture(g.candidate))
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const expectedFail = (task: string, fixture: 'reference' | 'flawed') => new Set(byId.get(task)!.fixtures?.expected[fixture].fail ?? [])
  const asFixture = (g: StoredGrade): JudgeGrade => ({ ...g, candidate: g.candidate.replace('fixture-', 'fixture:') })

  const judges = calibrate(fixtures.map(asFixture), expectedFail)
  let panelResult: CalibrationResult | null = null
  if (judgeIds.length > 1) {
    const groups = new Map<string, StoredGrade[]>()
    for (const g of fixtures) groups.set(`${g.candidate}\0${g.task}`, [...(groups.get(`${g.candidate}\0${g.task}`) ?? []), g])
    const panelGrades: JudgeGrade[] = []
    for (const gs of groups.values()) {
      if (judgeIds.some((j) => !gs.some((g) => g.judge === j))) continue
      const t = byId.get(gs[0]!.task)!
      panelGrades.push({
        ...asFixture(gs[0]!),
        judge: 'panel (majority)',
        criteria: t.spec.criteria.map((c) => ({
          id: c.id,
          verdict: panelVerdict(judgeIds.map((j) => gs.find((g) => g.judge === j)!.criteria.find((x) => x.id === c.id)?.verdict ?? 'error'), judgeIds.length),
          reasoning: '',
        })),
      })
    }
    panelResult = calibrate(panelGrades, expectedFail)[0] ?? null
  }

  const L: string[] = ['# Judge calibration', '']
  L.push('Every task ships a **reference** deliverable that must pass every criterion and a **flawed** one with planted errors that must fail exactly the criteria listed in `fixtures/expected.json`. A judge\'s accuracy is the share of those verdicts it gets right. A *false pass* — passing a planted error — is the costly direction.', '')
  L.push('| Judge | Verdicts | Accuracy | False passes | False fails | Errors |', '|---|---|---|---|---|---|')
  for (const j of [...judges, ...(panelResult ? [panelResult] : [])]) {
    L.push(`| ${j.judge} | ${j.items} | **${(j.accuracy * 100).toFixed(1)}%** | ${j.false_pass} | ${j.false_fail} | ${j.errors} |`)
  }
  L.push('')
  const misses = [...judges, ...(panelResult ? [panelResult] : [])].flatMap((j) => j.misses.map((m) => ({ judge: j.judge, ...m })))
  if (misses.length) {
    L.push('## Misses', '', '| Judge | Task | Fixture | Criterion | Expected | Got |', '|---|---|---|---|---|---|')
    for (const m of misses) L.push(`| ${m.judge} | ${m.task} | ${m.fixture} | ${m.criterion} | ${m.expected} | ${m.got} |`)
    L.push('')
  }
  return { json: { judges, panel: panelResult }, markdown: `${L.join('\n')}\n` }
}
