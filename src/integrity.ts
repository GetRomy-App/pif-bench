/**
 * Offline task integrity — what CI runs on every change to `tasks/`. A task
 * that fails here is not gradeable; one that only warns is.
 */
import { discoverTaskIds, fileByPath, loadTask, type Task, TASKS_DIR } from './tasks'

export interface IntegrityReport {
  id: string
  errors: string[]
  warnings: string[]
}

const MAX_PACKET_CHARS = 150_000

export function checkTask(task: Task): IntegrityReport {
  const errors: string[] = []
  const warnings: string[] = []
  const { spec } = task
  const ids = spec.criteria.map((c) => c.id)

  ids.forEach((id, i) => {
    const want = `C-${String(i + 1).padStart(3, '0')}`
    if (id !== want) errors.push(`criterion #${i + 1} is ${id}; ids run C-001, C-002, … in order (expected ${want})`)
  })
  const seenTitles = new Set<string>()
  const seenText = new Set<string>()
  for (const c of spec.criteria) {
    if (!/\bPASS if\b/.test(c.match_criteria)) errors.push(`${c.id}: match_criteria must say "PASS if …"`)
    if (!/\bFAIL if\b/.test(c.match_criteria)) errors.push(`${c.id}: match_criteria must say "FAIL if …" — name the failure mode`)
    if (seenTitles.has(c.title)) errors.push(`${c.id}: duplicate title "${c.title}"`)
    if (seenText.has(c.match_criteria)) errors.push(`${c.id}: duplicate match_criteria`)
    seenTitles.add(c.title)
    seenText.add(c.match_criteria)
    for (const s of c.sources) {
      if (!fileByPath(task, s)) errors.push(`${c.id}: source "${s}" is not a file under documents/ or references/`)
    }
    if (spec.track === 'live' && c.evidence.length === 0) errors.push(`${c.id}: live criteria must cite at least one evidence URL`)
    // A "no source in the files" criterion can only be judged against the whole packet; with a
    // partial packet the judge sees true facts from the missing files as inventions (calibration, 2026-10-10).
    if (spec.track === 'packet' && /no source in the files/i.test(c.match_criteria)) {
      const missing = task.documents.map((d) => d.path).filter((p) => !c.sources.includes(p))
      if (missing.length) errors.push(`${c.id}: a no-invention criterion must list every packet document in sources (missing ${missing.join(', ')})`)
    }
  }

  if (spec.track === 'packet') {
    if (!task.documents.length) errors.push('packet tasks need at least one file in documents/')
    const chars = task.documents.reduce((n, f) => n + f.content.length, 0)
    if (chars > MAX_PACKET_CHARS) errors.push(`documents/ holds ${chars} characters; keep a packet under ${MAX_PACKET_CHARS}`)
  } else {
    if (task.documents.length) errors.push('live tasks give the system nothing — move files to references/ (judge-only)')
  }

  if (!task.fixtures) {
    errors.push('missing fixtures/ (reference.md, flawed.md, expected.json) — every task ships its own judge self-test')
  } else {
    const known = new Set(ids)
    const { reference, flawed } = task.fixtures.expected
    for (const id of [...reference.fail, ...flawed.fail]) {
      if (!known.has(id)) errors.push(`fixtures/expected.json names ${id}, which is not a criterion`)
    }
    if (reference.fail.length) errors.push('fixtures/expected.json: the reference deliverable must pass every criterion (reference.fail must be empty)')
    if (new Set(flawed.fail).size !== flawed.fail.length) errors.push('fixtures/expected.json: flawed.fail lists a criterion twice')
    if (flawed.fail.length === ids.length) warnings.push('the flawed fixture fails every criterion — plant a few specific errors instead, so the self-test also checks judges pass what is right')
    if (task.fixtures.reference.trim().length < 200) errors.push('fixtures/reference.md is too short to be a real deliverable')
  }

  if (spec.criteria.length < 8) warnings.push(`only ${spec.criteria.length} criteria — a supervising development officer would usually check more`)
  if (!spec.criteria.some((c) => c.red_line)) warnings.push('no red_line criterion — is there truly nothing here that could harm a donor relationship?')
  return { id: task.id, errors, warnings }
}

/** Load and check every task. A task that cannot even load is reported as an error, not thrown. */
export function checkAll(tasksDir = TASKS_DIR): IntegrityReport[] {
  return discoverTaskIds(tasksDir).map((id) => {
    try {
      return checkTask(loadTask(id, tasksDir))
    } catch (e) {
      return { id, errors: [(e as Error).message], warnings: [] }
    }
  })
}
