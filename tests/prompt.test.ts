import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { CANDIDATE_SYSTEM, candidateMessages, JUDGE_SYSTEM, jsonObjectSpans, judgeMessages, parseVerdict } from '../src/prompt'
import { blind } from '../src/redact'
import { loadTask } from '../src/tasks'

const FIXTURE_TASKS = join(import.meta.dir, 'fixtures', 'tasks')

describe('parseVerdict', () => {
  test('reads plain JSON, fenced JSON and JSON after prose', () => {
    expect(parseVerdict('{"reasoning": "ok", "verdict": "pass"}')).toEqual({ verdict: 'pass', reasoning: 'ok' })
    expect(parseVerdict('```json\n{"reasoning": "missing $15,000", "verdict": "fail"}\n```')).toEqual({ verdict: 'fail', reasoning: 'missing $15,000' })
    expect(parseVerdict('Let me check.\n\n{"reasoning":"r","verdict":"PASS"}')).toEqual({ verdict: 'pass', reasoning: 'r' })
  })

  test('ignores braces inside the reasoning string', () => {
    const text = '{"reasoning": "The memo says {see table} and \\"closes }\\" fine", "verdict": "fail"}'
    expect(parseVerdict(text).verdict).toBe('fail')
  })

  test('the last valid verdict object wins', () => {
    expect(parseVerdict('Draft: {"verdict": "pass", "reasoning": "a"} Final: {"verdict": "fail", "reasoning": "b"}').verdict).toBe('fail')
  })

  test('reads the verdict when the reasoning quotes text with unescaped double quotes', () => {
    const broken = '{"reasoning": "It says "Netflix equity is the core of his wealth" and gives $4.1 billion.", "verdict": "pass"}'
    expect(() => JSON.parse(broken)).toThrow()
    expect(parseVerdict(broken)).toEqual({ verdict: 'pass', reasoning: 'It says "Netflix equity is the core of his wealth" and gives $4.1 billion.' })
  })

  test('in broken JSON too, the judge\'s last verdict counts', () => {
    expect(parseVerdict('{"reasoning": "x "y" z", "verdict": "pass"} on reflection {"verdict": "fail", "reasoning": "a "b""}').verdict).toBe('fail')
  })

  test('a pass the judge took back is never returned', () => {
    expect(() => parseVerdict('{"verdict": "pass", "reasoning": "a"} Correction: {"verdict": "fail (revised)", "reasoning": "b"}')).toThrow(/not pass\/fail/)
    expect(parseVerdict('{"verdict": "pass", "reasoning": "a"} Correction: {"verdict": "fail", "reasoning": "b"}')).toEqual({ verdict: 'fail', reasoning: 'b' })
  })

  test('rejects replies without a pass/fail verdict', () => {
    expect(() => parseVerdict('I think it passes.')).toThrow()
    expect(() => parseVerdict('{"verdict": "partial", "reasoning": "x"}')).toThrow()
    expect(() => parseVerdict('{"reasoning": "x"}')).toThrow()
  })

  test('jsonObjectSpans finds top-level objects only', () => {
    expect(jsonObjectSpans('a {"x": {"y": 1}} b {"z": "}"}')).toEqual(['{"x": {"y": 1}}', '{"z": "}"}'])
  })
})

describe('candidateMessages', () => {
  const task = loadTask('prospect-research/tiny-task', FIXTURE_TASKS)

  test('packet tasks: generic system preamble, files first, assignment last', () => {
    const { system, messages } = candidateMessages(task)
    expect(system).toBe(CANDIDATE_SYSTEM)
    const user = messages[0]!.content as string
    expect(user.startsWith(`Today's date: ${task.spec.as_of}`)).toBe(true)
    expect(user.indexOf('<file path="documents/record.md">')).toBeLessThan(user.indexOf('<assignment>'))
    expect(user).toContain(task.spec.instructions)
    expect(user).toContain('`tiny-memo.md`')
    // The candidate never sees the rubric or the fixtures.
    expect(user).not.toContain('PASS if')
    expect(user).not.toContain(task.fixtures!.reference.slice(0, 40))
  })

  test('live tasks send the prompt verbatim, nothing else', () => {
    const live = loadTask('live-prospects/tiny-live', FIXTURE_TASKS)
    const { system, messages } = candidateMessages(live)
    expect(system).toBeUndefined()
    expect(messages).toEqual([{ role: 'user', content: live.spec.instructions }])
  })
})

describe('judgeMessages', () => {
  const task = loadTask('prospect-research/tiny-task', FIXTURE_TASKS)
  const textOf = (c: { text: string }[]) => c.map((p) => p.text).join('\n')

  test('one criterion per call; reference files only when the criterion names them', () => {
    const plain = judgeMessages(task, 'DELIVERABLE', task.spec.criteria[0]!)
    const parts = plain[0]!.content as { text: string }[]
    expect(parts).toHaveLength(2)
    expect(parts[0]!.text).toContain('DELIVERABLE')
    expect(parts[1]!.text).toContain(task.spec.criteria[0]!.match_criteria)
    expect(textOf(parts)).not.toContain(task.spec.criteria[1]!.match_criteria)
    expect(textOf(parts)).not.toContain('<reference_files>')

    const sourced = judgeMessages(task, 'DELIVERABLE', task.spec.criteria[1]!)
    expect(textOf(sourced[0]!.content as { text: string }[])).toContain('<file path="documents/record.md">')
  })

  test('the shared prefix is identical across criteria (so it can be cached)', () => {
    const a = (judgeMessages(task, 'D', task.spec.criteria[0]!)[0]!.content as { text: string }[])[0]!.text
    const b = (judgeMessages(task, 'D', task.spec.criteria[1]!)[0]!.content as { text: string }[])[0]!.text
    expect(a).toBe(b)
  })

  test('the judge system prompt demands JSON and forbids outside knowledge', () => {
    expect(JUDGE_SYSTEM).toContain('JSON only')
    expect(JUDGE_SYSTEM).toContain('Do not substitute your own knowledge')
  })
})

describe('blind', () => {
  test('redacts system and vendor names as whole words', () => {
    const text = 'Prepared by Rōmy (RōmyScore 71). Claude Opus 4.7 and ChatGPT disagreed; GPT-5.3 and Gemini 3.1 Pro too. Anthropic, OpenAI.'
    const out = blind(text)
    for (const name of ['Rōmy', 'Claude', 'ChatGPT', 'GPT-5.3', 'Gemini', 'Anthropic', 'OpenAI']) expect(out).not.toContain(name)
    expect(out).toContain('[score] 71')
    expect(out).toContain('[the assistant]')
  })

  test('strips per-product tracking tags from citation links', () => {
    expect(blind('[1]: https://x.com/a?utm_source=chatgpt.com "A" and https://y.org/b?id=2&utm_source=openai&x=1 and (https://z.io/c?utm_source=openai)')).toBe('[1]: https://x.com/a "A" and https://y.org/b?id=2&x=1 and (https://z.io/c)')
  })

  test('catches dash variants, decomposed accents, bare versions and prefixed names', () => {
    const out = blind('GPT\u20115.3, GPT\u20135.3, Ro\u0304my, Opus 4.7, Sonnet 5, MiniMax M3, Muse Spark 1.3, non-Claude')
    expect(out).toBe('[the assistant], [the assistant], [the assistant], [the assistant], [the assistant], [the assistant], [the assistant], non-[the assistant]')
  })

  test('blinds names joined to a following word by a hyphen', () => {
    expect(blind('A Rōmy-style profile; Claude-generated notes')).toBe('A [the assistant]-style profile; [the assistant]-generated notes')
  })

  test('leaves ordinary words alone', () => {
    const text = 'Holdings: Alphabet (Google) stock; Claudette Romyn; the romyfoundation.org site; a sonnet; magnum opus'
    expect(blind(text)).toBe(text)
  })

  test('blinds extra terms on request', () => {
    expect(blind('Acme Research says hi', ['Acme Research'])).toBe('[the assistant] says hi')
  })
})
