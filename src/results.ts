/**
 * The results store — plain files, so a run can be resumed, diffed, audited
 * and committed as a leaderboard snapshot.
 *
 *   <run>/
 *     outputs/<candidate>/<task-id>/a<N>.md          the deliverable, verbatim
 *     outputs/<candidate>/<task-id>/a<N>.meta.json   model, tokens, cost, latency — or import provenance
 *     grades/<judge>/<candidate>/<task-id>/a<N>.json one judge's verdict + reasoning per criterion
 *     report.json, report.md
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { JudgeGrade } from './score'
import { ROOT } from './tasks'

export function resolveRunDir(run: string): string {
  return isAbsolute(run) || run.startsWith('.') || run.includes('/') ? resolve(run) : join(ROOT, 'results', run)
}

export interface OutputMeta {
  candidate: string
  task: string
  attempt: number
  /** The task's promptHash when the deliverable was produced. */
  promptHash: string
  source: 'api' | 'import' | 'fixture'
  model?: string
  finishReason?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  latencyMs?: number
  createdAt: string
  /** Import provenance: where the text came from and how it was collected. */
  importedFrom?: string
  collectedAt?: string
  notes?: string
}

export interface StoredOutput {
  candidate: string
  task: string
  attempt: number
  text: string
  meta: OutputMeta | null
}

export function outputPath(runDir: string, candidate: string, task: string, attempt: number): string {
  return join(runDir, 'outputs', candidate, ...task.split('/'), `a${attempt}.md`)
}

export function gradePath(runDir: string, judge: string, candidate: string, task: string, attempt: number): string {
  return join(runDir, 'grades', judge, candidate, ...task.split('/'), `a${attempt}.json`)
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

export function writeOutput(runDir: string, text: string, meta: OutputMeta): void {
  const p = outputPath(runDir, meta.candidate, meta.task, meta.attempt)
  writeFile(p, text.endsWith('\n') ? text : `${text}\n`)
  writeFile(p.replace(/\.md$/, '.meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  rmSync(p.replace(/\.md$/, '.failed.json'), { force: true })
}

export interface GenerationFailure {
  candidate: string
  task: string
  attempt: number
  error: string
  failedAt: string
}

/** A generation that produced nothing is recorded, so the system still counts — and scores 0 on that task. */
export function writeFailure(runDir: string, f: GenerationFailure): void {
  writeFile(outputPath(runDir, f.candidate, f.task, f.attempt).replace(/\.md$/, '.failed.json'), `${JSON.stringify(f, null, 2)}\n`)
}

export function readFailures(runDir: string): GenerationFailure[] {
  return walk(join(runDir, 'outputs'))
    .filter((f) => f.endsWith('.failed.json'))
    .map((f) => JSON.parse(readFileSync(f, 'utf8')) as GenerationFailure)
}

/** sha256 of a deliverable's exact text: every grade records the text it graded. */
export function deliverableHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const full = join(dir, n)
      return statSync(full).isDirectory() ? walk(full) : [full]
    })
}

/** Every stored deliverable in a run. */
export function readOutputs(runDir: string): StoredOutput[] {
  const base = join(runDir, 'outputs')
  return walk(base)
    .filter((f) => /\/a\d+\.md$/.test(f.split(sep).join('/')))
    .map((f) => {
      const parts = relative(base, f).split(sep)
      const candidate = parts[0]!
      const attempt = Number(parts.at(-1)!.replace(/^a(\d+)\.md$/, '$1'))
      const task = parts.slice(1, -1).join('/')
      const metaFile = f.replace(/\.md$/, '.meta.json')
      return {
        candidate,
        task,
        attempt,
        text: readFileSync(f, 'utf8'),
        meta: existsSync(metaFile) ? (JSON.parse(readFileSync(metaFile, 'utf8')) as OutputMeta) : null,
      }
    })
    .sort((a, b) => a.candidate.localeCompare(b.candidate) || a.task.localeCompare(b.task) || a.attempt - b.attempt)
}

export interface StoredGrade extends JudgeGrade {
  gradedAt: string
  judgeModel: string
  /** deliverableHash() of the text the judge graded. */
  deliverableHash: string
  /** The grading protocol (judge prompt + template + blinding) the grade was made under. */
  protocol: string
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number }
}

export function writeGrade(runDir: string, grade: StoredGrade): void {
  writeFile(gradePath(runDir, grade.judge, grade.candidate, grade.task, grade.attempt), `${JSON.stringify(grade, null, 2)}\n`)
}

export function readGrade(path: string): StoredGrade | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as StoredGrade) : null
}

/** Every grade file in a run, in path order (so rebuilt reports are byte-identical). */
export function readGrades(runDir: string): StoredGrade[] {
  return walk(join(runDir, 'grades'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(f, 'utf8')) as StoredGrade)
}

export function writeJson(path: string, value: unknown): void {
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function writeText(path: string, text: string): void {
  writeFile(path, text)
}
