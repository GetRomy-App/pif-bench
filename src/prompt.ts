/**
 * What a candidate sees, and what a judge sees.
 *
 * Candidates get one generic preamble (the same for every task and every
 * system), the scenario date, the packet's files, then the assignment —
 * long material first, the ask last.
 *
 * A judge gets one criterion at a time: the assignment, the blinded
 * deliverable, the reference files that criterion names (if any), then the
 * criterion. Everything before the reference files is identical across a
 * deliverable's criteria, so the gateway's prompt cache serves it after the
 * first call.
 */
import { createHash } from 'node:crypto'
import type { ModelMessage } from 'ai'
import { REDACTION_SIGNATURE } from './redact'
import type { Criterion } from './schema'
import { fileByPath, type Task } from './tasks'

export const CANDIDATE_SYSTEM = `You are assisting the staff of a nonprofit organization with development (fundraising) work.

The files for this assignment are provided below. Treat them as the complete record available to you: base every statement about people, organizations, gifts and figures on these files, and cite the file path (for example [documents/deed-records.md]) for each fact you take from them. Where the files do not answer something the assignment asks, say so plainly instead of estimating or guessing.

Return the deliverable itself as a single Markdown document, with no preamble and no closing offer of further help.`

function fileBlock(path: string, content: string): string {
  return `<file path="${path}">\n${content.trimEnd()}\n</file>`
}

export function candidateMessages(task: Task): { system?: string; messages: ModelMessage[] } {
  const { spec } = task
  if (spec.track === 'live') {
    // Live tasks are the exact prompt a fundraiser would type into a product.
    return { messages: [{ role: 'user', content: spec.instructions }] }
  }
  const files = task.documents.map((f) => fileBlock(f.path, f.content)).join('\n\n')
  const user = `Today's date: ${spec.as_of}

<files>
${files}
</files>

<assignment>
${spec.instructions.trim()}

Deliverable: \`${spec.deliverable}\` (Markdown).
</assignment>`
  return { system: CANDIDATE_SYSTEM, messages: [{ role: 'user', content: user }] }
}

export const JUDGE_SYSTEM = `You grade one rubric criterion at a time for a benchmark of AI systems that do nonprofit development (fundraising) work. You see the assignment the system was given, the deliverable it produced, and one criterion. Decide whether the deliverable satisfies that criterion.

Rules:
1. Grade only the criterion in front of you. The deliverable's other strengths and weaknesses do not matter.
2. The criterion's PASS/FAIL text is the standard. Do not substitute your own knowledge or opinion for it.
3. Match substance, not wording. Different phrasing of the required point passes; formatting differences in numbers ($1.2M vs $1,200,000) do not matter.
4. Numbers must equal the criterion's figures unless the criterion states a tolerance.
5. Where the criterion says FAIL if something appears, look through the whole deliverable for it.
6. If the deliverable states the required point and also contradicts it elsewhere, it fails.
7. Reference files, when given, are ground truth for facts.
8. The deliverable has been blinded: names of AI systems read "[the assistant]". Ignore that.

Respond with JSON only, no code fence: {"reasoning": "<2-4 sentences, quoting the deliverable where it decides the verdict>", "verdict": "pass" | "fail"}`

export function judgeMessages(task: Task, deliverable: string, criterion: Criterion): ModelMessage[] {
  const shared = `<assignment title="${task.spec.title.replace(/"/g, "'")}" date="${task.spec.as_of}">
${task.spec.instructions.trim()}
</assignment>

<deliverable>
${deliverable.trim()}
</deliverable>`
  const refs = criterion.sources
    .map((p) => {
      const f = fileByPath(task, p)
      if (!f) throw new Error(`${task.id} ${criterion.id}: source ${p} not found`)
      return fileBlock(f.path, f.content)
    })
    .join('\n\n')
  const tail = `${refs ? `<reference_files>\n${refs}\n</reference_files>\n\n` : ''}<criterion id="${criterion.id}" title="${criterion.title.replace(/"/g, "'")}">
${criterion.match_criteria.trim()}
</criterion>

Grade this one criterion. JSON only: {"reasoning": "...", "verdict": "pass" | "fail"}`
  return [
    {
      role: 'user',
      content: [
        // Anthropic caches only up to an explicit breakpoint; other providers ignore the marker.
        // (Measured 2026-10-10 through the gateway: Claude reads the cache at ~5% of the price;
        // GPT-6.1 Sol writes but never reads it; Gemini on Vertex does not cache.)
        { type: 'text', text: shared, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
        { type: 'text', text: tail },
      ],
    },
  ]
}

export interface ParsedVerdict {
  verdict: 'pass' | 'fail'
  reasoning: string
}

/** Every top-level `{…}` span in `text`, braces inside JSON strings ignored. */
export function jsonObjectSpans(text: string): string[] {
  const spans: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"' && depth > 0) inString = true
    else if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}' && depth > 0) {
      depth--
      if (depth === 0) spans.push(text.slice(start, i + 1))
    }
  }
  return spans
}

/**
 * Pull the verdict out of a judge reply. The judge's LAST word counts: the
 * last JSON object with a "verdict" key decides, and if that verdict is not
 * pass/fail the reply is rejected (never an earlier "pass" the judge took
 * back). Replies whose reasoning breaks JSON (unescaped quotes) fall back to
 * the last `"verdict": "…"` in the text, under the same rule.
 */
export function parseVerdict(text: string): ParsedVerdict {
  const accept = (raw: unknown, reasoning: unknown): ParsedVerdict => {
    const v = String(raw ?? '').trim().toLowerCase()
    if (v !== 'pass' && v !== 'fail') throw new Error(`judge's final verdict is not pass/fail: ${JSON.stringify(String(raw)).slice(0, 60)}`)
    return { verdict: v, reasoning: String(reasoning ?? '').trim() }
  }
  for (const span of jsonObjectSpans(text.replace(/```(?:json)?/gi, '')).reverse()) {
    let obj: unknown
    try {
      obj = JSON.parse(span)
    } catch {
      continue
    }
    if (obj && typeof obj === 'object' && 'verdict' in obj) {
      const o = obj as { verdict?: unknown; reasoning?: unknown }
      return accept(o.verdict, o.reasoning)
    }
  }
  const verdicts = [...text.matchAll(/"verdict"\s*:\s*"([^"]*)"/gi)]
  if (verdicts.length) {
    const reasons = [...text.matchAll(/"reasoning"\s*:\s*"([\s\S]*?)"\s*,\s*"verdict"/gi)]
    return accept(verdicts.at(-1)![1], reasons.at(-1)?.[1] ?? '')
  }
  throw new Error(`judge reply has no {"verdict": "pass"|"fail"} object: ${text.slice(0, 200)}`)
}

/** A minimal task, rendered through the judge prompt to fingerprint the grading protocol. */
export function sampleTask(): Task {
  const spec: Task['spec'] = {
    title: 'Sample task',
    track: 'packet',
    work_type: 'analyze',
    as_of: '2026-01-01',
    tags: [],
    instructions: 'Sample instructions.',
    deliverable: 'sample.md',
    criteria: [{ id: 'C-001', title: 'Sample criterion', match_criteria: 'PASS if a. FAIL if b.', sources: ['documents/a.md'], red_line: false, evidence: [] }],
  }
  return { id: 'sample/sample', area: 'prospect-research', dir: '', spec, documents: [{ path: 'documents/a.md', content: 'A' }], references: [], fixtures: null, hash: '', promptHash: '' }
}

/**
 * The harness grading protocol: the judge system prompt, the message template
 * and the blinding rules. Stored with every grade; a grade made under another
 * protocol is redone, never mixed with current ones.
 */
export const HARNESS_PROTOCOL = createHash('sha256')
  .update(`${JUDGE_SYSTEM}\0${JSON.stringify(judgeMessages(sampleTask(), 'SAMPLE', sampleTask().spec.criteria[0]!))}\0${REDACTION_SIGNATURE}`)
  .digest('hex')
  .slice(0, 12)
