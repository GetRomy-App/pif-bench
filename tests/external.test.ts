import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Panel } from '../src/config'
import { exportJudging, importVerdicts, type JudgingKey } from '../src/external'
import { buildCalibration, buildReport } from '../src/report'
import { outputPath, writeOutput } from '../src/results'
import { stageFixtures } from '../src/run'
import { selectTasks } from '../src/tasks'

const FIXTURE_TASKS = join(import.meta.dir, 'fixtures', 'tasks')
const temps: string[] = []
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })))
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'pif-ext-'))
  temps.push(d)
  return d
}
const tasks = selectTasks('all', FIXTURE_TASKS)
const tiny = tasks.find((t) => t.id === 'prospect-research/tiny-task')!
const SELF: Panel = { name: 'self', judges: [{ id: 'blind-judge', model: 'external/agent', family: 'anthropic', maxOutputTokens: 1, external: true }] }

function setup() {
  const run = tempDir()
  const calib = tempDir()
  // Three systems answer the packet task; one names itself, which the packet must blind.
  writeOutput(run, `${tiny.fixtures!.reference}\n\nPrepared by Rōmy. Source: https://x.org/r?utm_source=chatgpt.com`, { candidate: 'sys-a', task: tiny.id, attempt: 1, promptHash: tiny.promptHash, source: 'api', createdAt: '' })
  writeOutput(run, tiny.fixtures!.flawed, { candidate: 'sys-b', task: tiny.id, attempt: 1, promptHash: tiny.promptHash, source: 'api', createdAt: '' })
  writeOutput(run, tiny.fixtures!.reference, { candidate: 'sys-c', task: tiny.id, attempt: 1, promptHash: tiny.promptHash, source: 'api', createdAt: '' })
  stageFixtures(calib, tasks)
  const out = tempDir()
  const keyFile = join(tempDir(), 'key.json')
  const r = exportJudging({ runDirs: [run, calib], tasks, outDir: out, keyFile, seed: 7, batchSize: 3 })
  const full = JSON.parse(readFileSync(keyFile, 'utf8')) as JudgingKey
  return { run, calib, out, keyFile, r, full, key: full.entries }
}

describe('judge-export', () => {
  test('writes one blinded packet per deliverable, keeps the key separate, and never batches two answers to one task together', () => {
    const { out, r, key } = setup()
    expect(r.packets).toBe(7) // 3 system answers + 2 fixtures × 2 tasks
    const packets = readdirSync(join(out, 'packets'))
    expect(packets).toHaveLength(7)
    for (const p of packets) {
      const text = readFileSync(join(out, 'packets', p), 'utf8')
      expect(text).not.toMatch(/sys-[abc]|fixture-|Rōmy|utm_source/)
      expect(text).toContain('## Criteria')
    }
    expect(existsSync(join(out, 'key.json'))).toBe(false)
    for (const batch of r.batches) {
      const taskIds = batch.map((id) => key[id]!.task)
      expect(new Set(taskIds).size).toBe(taskIds.length)
    }
    expect(r.batches.flat().sort()).toEqual(Object.keys(key).sort())
  })

  test('packets share one timestamp, so file times reveal nothing about export order', () => {
    const { out } = setup()
    const times = new Set(readdirSync(join(out, 'packets')).map((p) => statSync(join(out, 'packets', p)).mtimeMs))
    expect(times.size).toBe(1)
  })

  test('without a seed, the seed is random and recorded only in the key', () => {
    const run = tempDir()
    writeOutput(run, tiny.fixtures!.reference, { candidate: 'sys-a', task: tiny.id, attempt: 1, promptHash: tiny.promptHash, source: 'api', createdAt: '' })
    const k1 = join(tempDir(), 'k.json')
    const k2 = join(tempDir(), 'k.json')
    exportJudging({ runDirs: [run], tasks, outDir: tempDir(), keyFile: k1, batchSize: 3 })
    exportJudging({ runDirs: [run], tasks, outDir: tempDir(), keyFile: k2, batchSize: 3 })
    const a = JSON.parse(readFileSync(k1, 'utf8')) as JudgingKey
    const b = JSON.parse(readFileSync(k2, 'utf8')) as JudgingKey
    expect(a.meta.seed).not.toBe(b.meta.seed)
    expect(Object.keys(a.entries)).not.toEqual(Object.keys(b.entries))
  })

  test('is reproducible for a seed', () => {
    const a = setup()
    const b = setup()
    expect(Object.keys(a.key).length).toBe(Object.keys(b.key).length)
    expect(a.r.batches.map((x) => x.length)).toEqual(b.r.batches.map((x) => x.length))
  })

  test('packets carry the reference files their criteria name', () => {
    const { out, key } = setup()
    const id = Object.keys(key).find((k) => key[k]!.task === tiny.id)!
    expect(readFileSync(join(out, 'packets', `${id}.md`), 'utf8')).toContain('### documents/record.md')
  })
})

describe('judge-import', () => {
  test('maps verdicts back to grades that report and calibrate like any judge', () => {
    const { run, calib, out, keyFile, key } = setup()
    const verdicts = join(out, 'verdicts')
    mkdirSync(verdicts)
    // A perfect judge: fails exactly what each deliverable gets wrong.
    for (const [id, e] of Object.entries(key)) {
      const t = tasks.find((x) => x.id === e.task)!
      const flawed = e.candidate === 'sys-b' || e.candidate === 'fixture-flawed'
      const fail = new Set(flawed ? t.fixtures!.expected.flawed.fail : [])
      writeFileSync(join(verdicts, `${id}.json`), JSON.stringify({ packet: id, criteria: t.spec.criteria.map((c) => ({ id: c.id, verdict: fail.has(c.id) ? 'fail' : 'pass', reasoning: 'r' })) }))
    }
    const r = importVerdicts({ verdictsDir: verdicts, keyFile, tasks, judge: 'blind-judge', judgeModel: 'external/agent' })
    expect(r).toEqual({ imported: 7, missing: [], invalid: [] })
    const report = buildReport(run, 'ext', [tiny], SELF, []).json
    expect(report.leaderboard.map((s) => [s.candidate, s.all_pass.value])).toEqual([
      ['sys-a', 1],
      ['sys-c', 1],
      ['sys-b', 0],
    ])
    const cal = buildCalibration(calib, tasks, SELF).json
    expect(cal.judges[0]!.accuracy).toBe(1)
  })

  test('rejects malformed, partial and duplicated verdict files whole — never half-imports one', () => {
    const { out, keyFile, key } = setup()
    const verdicts = join(out, 'verdicts')
    mkdirSync(verdicts)
    const ids = Object.keys(key).filter((k) => key[k]!.task === tiny.id)
    const all = (id: string, f: (c: string) => string = () => 'pass') => tiny.spec.criteria.map((c) => ({ id: c.id, verdict: f(c.id), reasoning: 'r' }))
    writeFileSync(join(verdicts, `${ids[0]}.json`), JSON.stringify({ packet: ids[0], criteria: [{ id: 'C-001', verdict: 'maybe', reasoning: '' }] }))
    writeFileSync(join(verdicts, `${ids[1]}.json`), JSON.stringify({ packet: ids[1], criteria: all(ids[1]!).slice(0, 3) }))
    writeFileSync(join(verdicts, `${ids[2]}.json`), JSON.stringify({ packet: ids[2], criteria: [...all(ids[2]!), { id: 'C-001', verdict: 'fail', reasoning: 'again' }] }))
    const r = importVerdicts({ verdictsDir: verdicts, keyFile, tasks, judge: 'blind-judge', judgeModel: 'external/agent' })
    expect(r.imported).toBe(0)
    const why = Object.fromEntries(r.invalid.map((i) => [i.packet, i.error]))
    expect(why[ids[1]!]).toMatch(/no verdict for C-004, C-005/)
    expect(why[ids[2]!]).toMatch(/repeats C-001/)
    expect(r.missing).toHaveLength(4)
  })

  test('refuses verdicts on a deliverable that changed after its packet was made', () => {
    const { run, out, keyFile, key } = setup()
    const verdicts = join(out, 'verdicts')
    mkdirSync(verdicts)
    const id = Object.keys(key).find((k) => key[k]!.candidate === 'sys-b')!
    writeFileSync(join(verdicts, `${id}.json`), JSON.stringify({ packet: id, criteria: tiny.spec.criteria.map((c) => ({ id: c.id, verdict: 'pass', reasoning: 'r' })) }))
    writeFileSync(outputPath(run, 'sys-b', tiny.id, 1), 'a corrected deliverable')
    const r = importVerdicts({ verdictsDir: verdicts, keyFile, tasks, judge: 'blind-judge', judgeModel: 'external/agent' })
    expect(r.invalid[0]!.error).toMatch(/changed after the packet was made/)
  })
})
