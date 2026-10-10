/**
 * Blinding. Before a judge reads a deliverable, the names of AI systems and
 * their makers are replaced with "[the assistant]", and the tracking tags some
 * products add to every citation link (`utm_source=chatgpt.com`) are removed,
 * so a judge grading its own family's work cannot tell. This is best-effort:
 * house formats (section counts, signature headings, a score line) can still
 * give a system away, which is one reason criteria test specific content,
 * never style, and why reports print a self-preference check.
 *
 * Only whole words are replaced. Packet tasks never use these names for
 * people; on live tasks, a fact sheet tells judges when a redaction hides a
 * real fact (a prospect who sits on an AI company's board).
 */
import { createHash } from 'node:crypto'

/** Hyphen and dash characters a model may print in "GPT-5.3" (U+2010–U+2015, minus sign, small/fullwidth hyphen-minus). */
const DASH = '\\-\\u2010-\\u2015\\u2212\\uFE58\\uFE63\\uFF0D'
const VERSION = `[${DASH}\\s]?\\d[\\w.]*`

const SYSTEM_NAMES = [
  'R[oōŌO]my(?:Score)?',
  'ChatGPT',
  'OpenAI',
  `GPT${VERSION}(?:\\s+(?:Sol|Luna|Terra|Astra|Pro|mini|nano|Turbo))?`,
  `Claude(?:\\s+(?:Opus|Sonnet|Haiku|Fable)(?:\\s+\\d[\\d.]*)?)?(?:\\.ai)?`,
  // A bare model name needs its version number, so "a sonnet" or "magnum opus" is left alone.
  `(?:Opus|Sonnet|Haiku|Fable)\\s+\\d[\\d.]*`,
  'Anthropic',
  `Gemini(?:\\s+\\d[\\d.]*)?(?:\\s+(?:Pro|Flash|Ultra|Flash-Lite|app))?`,
  'Google DeepMind',
  'Perplexity(?:\\.ai)?',
  `Grok(?:\\s+\\d[\\d.]*)?`,
  'Copilot',
  `MiniMax(?:${VERSION}|\\s+M\\d[\\w.]*)?`,
  `Muse\\s+Spark(?:\\s+\\d[\\d.]*)?`,
  `Kimi(?:\\s+K\\d[\\w.]*)?`,
  `DeepSeek(?:${VERSION})?`,
]

// A hyphen before a name does not protect it either ("non-Claude").
const NOT_WORD_BEFORE = '(?<!\\w)'
const NOT_WORD_AFTER = '(?!\\w)'
const PATTERN = new RegExp(`${NOT_WORD_BEFORE}(?:${SYSTEM_NAMES.join('|')})${NOT_WORD_AFTER}`, 'giu')
/** `utm_*` parameters, e.g. `?utm_source=chatgpt.com` — a per-product fingerprint on every citation. */
const UTM = /([?&])utm_[a-z_]+=[^&#\s)\]"'>]*/gi

/** Changes whenever the blinding rules change; part of the grading-protocol hash. */
export const REDACTION_SIGNATURE = createHash('sha256')
  .update(`v3\0${PATTERN.source}\0${UTM.source}`)
  .digest('hex')
  .slice(0, 12)

function stripUtm(text: string): string {
  return text
    .replace(UTM, '$1')
    .replace(/([?&])&+/g, '$1') // "?&a=1" → "?a=1", "&&" → "&"
    .replace(/[?&](?=[\s)\]"'>#]|$)/gm, '') // a query left empty
}

export function blind(text: string, extra: string[] = []): string {
  let out = stripUtm(text.normalize('NFC'))
  out = out.replace(PATTERN, (m) => (/score$/i.test(m) ? '[score]' : '[the assistant]'))
  for (const term of extra) {
    if (!term.trim()) continue
    const esc = term.normalize('NFC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`${NOT_WORD_BEFORE}${esc}${NOT_WORD_AFTER}`, 'giu'), '[the assistant]')
  }
  return out
}
