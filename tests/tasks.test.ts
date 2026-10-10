import { afterAll, describe, expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkAll, checkTask } from '../src/integrity'
import { discoverTaskIds, loadTask, selectTasks } from '../src/tasks'

const FIXTURE_TASKS = join(import.meta.dir, 'fixtures', 'tasks')
const temps: string[] = []
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })))

/** A private copy of the fixture tasks, mutated by `edit`, so each test checks one breakage. */
function brokenCopy(taskId: string, edit: (dir: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), 'pif-tasks-'))
  temps.push(root)
  cpSync(FIXTURE_TASKS, root, { recursive: true })
  edit(join(root, taskId))
  return root
}

function editJson(file: string, fn: (j: any) => void) {
  const j = JSON.parse(readFileSync(file, 'utf8'))
  fn(j)
  writeFileSync(file, JSON.stringify(j, null, 2))
}

describe('loading', () => {
  test('discovers tasks by directory and derives id and area from the path', () => {
    expect(discoverTaskIds(FIXTURE_TASKS)).toEqual(['live-prospects/tiny-live', 'prospect-research/tiny-task'])
    const t = loadTask('prospect-research/tiny-task', FIXTURE_TASKS)
    expect(t.area).toBe('prospect-research')
    expect(t.documents.map((d) => d.path)).toEqual(['documents/record.md'])
    expect(t.fixtures?.expected.flawed.fail).toEqual(['C-001', 'C-004'])
    expect(t.hash).toMatch(/^[0-9a-f]{16}$/)
  })

  test('selectors: all, track, area, id, and combinations', () => {
    expect(selectTasks('all', FIXTURE_TASKS)).toHaveLength(2)
    expect(selectTasks('live', FIXTURE_TASKS).map((t) => t.id)).toEqual(['live-prospects/tiny-live'])
    expect(selectTasks('packet', FIXTURE_TASKS).map((t) => t.id)).toEqual(['prospect-research/tiny-task'])
    expect(selectTasks('prospect-research', FIXTURE_TASKS)).toHaveLength(1)
    expect(selectTasks('prospect-research/tiny-task,live', FIXTURE_TASKS)).toHaveLength(2)
    expect(() => selectTasks('nope', FIXTURE_TASKS)).toThrow(/No task matches/)
  })

  test('the hash changes when the rubric or a document changes; the prompt hash only when the system input does', () => {
    const before = loadTask('prospect-research/tiny-task', FIXTURE_TASKS)
    const rubric = brokenCopy('prospect-research/tiny-task', (d) => editJson(join(d, 'task.json'), (j) => (j.criteria[0].match_criteria += ' Extra.')))
    expect(loadTask('prospect-research/tiny-task', rubric).hash).not.toBe(before.hash)
    expect(loadTask('prospect-research/tiny-task', rubric).promptHash).toBe(before.promptHash)
    const doc = brokenCopy('prospect-research/tiny-task', (d) => writeFileSync(join(d, 'documents', 'record.md'), 'changed'))
    expect(loadTask('prospect-research/tiny-task', doc).hash).not.toBe(before.hash)
    expect(loadTask('prospect-research/tiny-task', doc).promptHash).not.toBe(before.promptHash)
  })

  test('red_line and evidence edits do not force a re-grade (judges never see them)', () => {
    const before = loadTask('live-prospects/tiny-live', FIXTURE_TASKS).hash
    const root = brokenCopy('live-prospects/tiny-live', (d) =>
      editJson(join(d, 'task.json'), (j) => {
        j.criteria[0].red_line = true
        j.criteria[0].evidence = ['https://example.org/other']
      }),
    )
    expect(loadTask('live-prospects/tiny-live', root).hash).toBe(before)
  })

  test('a no-invention criterion must see the whole packet', () => {
    const root = brokenCopy('prospect-research/tiny-task', (d) => {
      writeFileSync(join(d, 'documents', 'policy.md'), '# Policy\nLeadership Circle: $1,000 in a year.')
      editJson(join(d, 'task.json'), (j) => (j.criteria[1].match_criteria += ' It fails only on a fact with no source in the files.'))
    })
    expect(checkTask(loadTask('prospect-research/tiny-task', root)).errors.join()).toMatch(/must list every packet document.*policy\.md/)
  })

  test('schema violations and bad files fail loudly', () => {
    const unknownField = brokenCopy('prospect-research/tiny-task', (d) => editJson(join(d, 'task.json'), (j) => (j.weight = 2)))
    expect(() => loadTask('prospect-research/tiny-task', unknownField)).toThrow(/schema/)
    const badJson = brokenCopy('prospect-research/tiny-task', (d) => writeFileSync(join(d, 'task.json'), '{ nope'))
    expect(() => loadTask('prospect-research/tiny-task', badJson)).toThrow(/not valid JSON/)
    const binary = brokenCopy('prospect-research/tiny-task', (d) => writeFileSync(join(d, 'documents', 'scan.pdf'), 'x'))
    expect(() => loadTask('prospect-research/tiny-task', binary)).toThrow(/only text files/)
  })
})

describe('integrity', () => {
  const errorsFor = (root: string, id: string) => checkTask(loadTask(id, root)).errors.join('\n')

  test('the fixture tasks are clean', () => {
    for (const r of checkAll(FIXTURE_TASKS)) expect(r.errors).toEqual([])
  })

  test('criterion ids must run in order', () => {
    const root = brokenCopy('prospect-research/tiny-task', (d) => editJson(join(d, 'task.json'), (j) => (j.criteria[1].id = 'C-009')))
    expect(errorsFor(root, 'prospect-research/tiny-task')).toMatch(/expected C-002/)
  })

  test('criteria must state both PASS and FAIL conditions', () => {
    const root = brokenCopy('prospect-research/tiny-task', (d) => editJson(join(d, 'task.json'), (j) => (j.criteria[0].match_criteria = 'PASS if the memo states that the gifts total $1,250 exactly.')))
    expect(errorsFor(root, 'prospect-research/tiny-task')).toMatch(/FAIL if/)
  })

  test('sources must exist', () => {
    const root = brokenCopy('prospect-research/tiny-task', (d) => editJson(join(d, 'task.json'), (j) => (j.criteria[1].sources = ['documents/missing.md'])))
    expect(errorsFor(root, 'prospect-research/tiny-task')).toMatch(/missing\.md/)
  })

  test('live criteria need evidence and live tasks give the system no documents', () => {
    const noEvidence = brokenCopy('live-prospects/tiny-live', (d) => editJson(join(d, 'task.json'), (j) => (j.criteria[0].evidence = [])))
    expect(errorsFor(noEvidence, 'live-prospects/tiny-live')).toMatch(/evidence URL/)
    const withDocs = brokenCopy('live-prospects/tiny-live', (d) => {
      cpSync(join(d, 'references'), join(d, 'documents'), { recursive: true })
    })
    expect(errorsFor(withDocs, 'live-prospects/tiny-live')).toMatch(/give the system nothing/)
  })

  test('fixtures are required and must be consistent with the rubric', () => {
    const noFixtures = brokenCopy('prospect-research/tiny-task', (d) => rmSync(join(d, 'fixtures'), { recursive: true }))
    expect(errorsFor(noFixtures, 'prospect-research/tiny-task')).toMatch(/missing fixtures/)
    const unknown = brokenCopy('prospect-research/tiny-task', (d) => editJson(join(d, 'fixtures', 'expected.json'), (j) => j.flawed.fail.push('C-042')))
    expect(errorsFor(unknown, 'prospect-research/tiny-task')).toMatch(/C-042/)
    const failingReference = brokenCopy('prospect-research/tiny-task', (d) => editJson(join(d, 'fixtures', 'expected.json'), (j) => j.reference.fail.push('C-001')))
    expect(errorsFor(failingReference, 'prospect-research/tiny-task')).toMatch(/reference deliverable must pass/)
  })

  test('an unknown area is reported, not thrown, by checkAll', () => {
    const root = brokenCopy('prospect-research/tiny-task', () => {})
    cpSync(join(root, 'prospect-research'), join(root, 'astrology'), { recursive: true })
    const r = checkAll(root).find((x) => x.id.startsWith('astrology/'))!
    expect(r.errors.join()).toMatch(/unknown area/)
  })
})

describe('the real benchmark', () => {
  test('every task under tasks/ passes integrity (the CI gate)', () => {
    const reports = checkAll()
    expect(reports.length).toBeGreaterThan(0)
    const failures = reports.filter((r) => r.errors.length).map((r) => `${r.id}:\n  ${r.errors.join('\n  ')}`)
    expect(failures).toEqual([])
  })
})
