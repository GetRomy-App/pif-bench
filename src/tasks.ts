/**
 * Task discovery and loading. A task is any directory under `tasks/` holding
 * a `task.json`; its id is the directory path relative to `tasks/`
 * (`prospect-research/namesake-disambiguation`), and its area is the first
 * path segment.
 *
 *   tasks/<area>/<task>/
 *     task.json          the instructions and the rubric
 *     documents/         what the system is given (packet tasks)
 *     references/        what only the judge sees (optional, live tasks)
 *     fixtures/          reference.md, flawed.md, expected.json — the judge self-test
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { AREAS, type Area, type Expected, ExpectedSchema, type TaskSpec, TaskSchema } from './schema'

export const ROOT = resolve(import.meta.dir, '..')
export const TASKS_DIR = join(ROOT, 'tasks')

export interface TaskFile {
  /** Task-relative posix path, e.g. `documents/screening-export.md`. */
  path: string
  content: string
}

export interface Task {
  id: string
  area: Area
  dir: string
  spec: TaskSpec
  documents: TaskFile[]
  references: TaskFile[]
  fixtures: { reference: string; flawed: string; expected: Expected } | null
  /** sha256 over instructions + rubric + documents + references. Recorded with every grade so a grade can never silently outlive an edited rubric. */
  hash: string
  /** sha256 over only what the system sees (instructions, deliverable, date, documents). Recorded with every deliverable: a rubric edit does not make a deliverable stale, a prompt edit does. */
  promptHash: string
}

const TEXT_EXT = /\.(md|txt|csv|json|tsv)$/i

function toPosix(p: string): string {
  return p.split(sep).join('/')
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(full))
    else out.push(full)
  }
  return out
}

function readTaskFiles(taskDir: string, sub: 'documents' | 'references'): TaskFile[] {
  return listFiles(join(taskDir, sub)).map((full) => {
    if (!TEXT_EXT.test(full)) throw new Error(`${toPosix(relative(TASKS_DIR, full))}: only text files (.md .txt .csv .tsv .json) may sit in ${sub}/`)
    return { path: toPosix(relative(taskDir, full)), content: readFileSync(full, 'utf8') }
  })
}

/** Every task id under `tasks/`, sorted. */
export function discoverTaskIds(tasksDir = TASKS_DIR): string[] {
  return listFiles(tasksDir)
    .filter((f) => f.endsWith(`${sep}task.json`))
    .map((f) => toPosix(relative(tasksDir, f)).replace(/\/task\.json$/, ''))
    .sort()
}

export function hashPrompt(spec: TaskSpec, documents: TaskFile[]): string {
  const h = createHash('sha256')
  h.update(JSON.stringify({ instructions: spec.instructions, deliverable: spec.deliverable, as_of: spec.as_of, track: spec.track }))
  for (const f of documents) h.update(`\0${f.path}\0${f.content}`)
  return h.digest('hex').slice(0, 16)
}

/**
 * What a judge sees: title, date, instructions, deliverable name, each criterion's id, title, text and
 * sources, and the files. `red_line` and `evidence` are left out — they change how a verdict is reported
 * or audited, not the verdict — so editing them does not force a re-grade.
 */
export function hashTask(spec: TaskSpec, documents: TaskFile[], references: TaskFile[]): string {
  const h = createHash('sha256')
  h.update(
    JSON.stringify({
      title: spec.title,
      instructions: spec.instructions,
      deliverable: spec.deliverable,
      as_of: spec.as_of,
      criteria: spec.criteria.map((c) => ({ id: c.id, title: c.title, match_criteria: c.match_criteria, sources: c.sources })),
    }),
  )
  for (const f of [...documents, ...references]) h.update(`\0${f.path}\0${f.content}`)
  return h.digest('hex').slice(0, 16)
}

export function loadTask(id: string, tasksDir = TASKS_DIR): Task {
  const dir = join(tasksDir, id)
  const area = id.split('/')[0] as Area
  if (!AREAS.includes(area)) throw new Error(`${id}: unknown area "${area}" (expected one of ${AREAS.join(', ')})`)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'))
  } catch (e) {
    throw new Error(`${id}: task.json is not valid JSON — ${(e as Error).message}`)
  }
  const parsed = TaskSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    throw new Error(`${id}: task.json fails the schema — ${issues}`)
  }
  const spec = parsed.data
  const documents = readTaskFiles(dir, 'documents')
  const references = readTaskFiles(dir, 'references')

  let fixtures: Task['fixtures'] = null
  const fx = join(dir, 'fixtures')
  if (existsSync(join(fx, 'expected.json'))) {
    const expected = ExpectedSchema.parse(JSON.parse(readFileSync(join(fx, 'expected.json'), 'utf8')))
    fixtures = {
      reference: readFileSync(join(fx, 'reference.md'), 'utf8'),
      flawed: readFileSync(join(fx, 'flawed.md'), 'utf8'),
      expected,
    }
  }
  return { id, area, dir, spec, documents, references, fixtures, hash: hashTask(spec, documents, references), promptHash: hashPrompt(spec, documents) }
}

/**
 * Resolve a selector to task ids: `all`, an area (`gift-compliance`), a task
 * id, or `packet` / `live` for a whole track. Comma-separate to combine.
 */
export function selectTasks(selector: string, tasksDir = TASKS_DIR): Task[] {
  const ids = discoverTaskIds(tasksDir)
  const all = ids.map((id) => loadTask(id, tasksDir))
  const picked = new Map<string, Task>()
  for (const part of selector.split(',').map((s) => s.trim()).filter(Boolean)) {
    const matches =
      part === 'all'
        ? all
        : part === 'packet' || part === 'live'
          ? all.filter((t) => t.spec.track === part)
          : all.filter((t) => t.id === part || t.id.startsWith(`${part}/`))
    if (!matches.length) throw new Error(`No task matches "${part}". Known areas: ${[...new Set(all.map((t) => t.area))].join(', ')}`)
    for (const t of matches) picked.set(t.id, t)
  }
  return [...picked.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function fileByPath(task: Task, path: string): TaskFile | undefined {
  return [...task.documents, ...task.references].find((f) => f.path === path)
}
