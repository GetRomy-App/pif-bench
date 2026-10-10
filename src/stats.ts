/**
 * Small, dependency-free statistics. Everything random is seeded, so a report
 * rebuilt from the same grades prints the same intervals.
 */

/** mulberry32 — a tiny seeded PRNG, uniform on [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN
}

/**
 * Percentile bootstrap CI for the mean of `values` (one value per task):
 * resample tasks with replacement. With few tasks the interval is honest
 * about how little a handful of tasks can say.
 */
export function bootstrapMeanCI(values: number[], { iterations = 10_000, level = 0.95, seed = 20260425 } = {}): [number, number] {
  if (!values.length) return [NaN, NaN]
  if (values.length === 1) return [values[0]!, values[0]!]
  const rand = rng(seed)
  const n = values.length
  const means = new Float64Array(iterations)
  for (let i = 0; i < iterations; i++) {
    let s = 0
    for (let j = 0; j < n; j++) s += values[Math.floor(rand() * n)]!
    means[i] = s / n
  }
  means.sort()
  const lo = means[Math.floor(((1 - level) / 2) * (iterations - 1))]!
  const hi = means[Math.ceil((1 - (1 - level) / 2) * (iterations - 1))]!
  return [lo, hi]
}

/** Cohen's kappa for two raters' binary verdicts on the same items. */
export function cohenKappa(a: boolean[], b: boolean[]): number {
  if (a.length !== b.length) throw new Error('cohenKappa: raters graded different numbers of items')
  const n = a.length
  if (!n) return NaN
  let agree = 0
  let aYes = 0
  let bYes = 0
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) agree++
    if (a[i]) aYes++
    if (b[i]) bYes++
  }
  const po = agree / n
  const pe = (aYes / n) * (bYes / n) + (1 - aYes / n) * (1 - bYes / n)
  if (pe === 1) return po === 1 ? 1 : 0
  return (po - pe) / (1 - pe)
}

/**
 * Fleiss' kappa for binary verdicts. `items[i]` holds every rater's verdict
 * on item i; every item must have the same number of raters (≥ 2).
 */
export function fleissKappa(items: boolean[][]): number {
  const N = items.length
  if (!N) return NaN
  const n = items[0]!.length
  if (n < 2 || items.some((r) => r.length !== n)) throw new Error('fleissKappa: every item needs the same number (≥ 2) of ratings')
  let pBar = 0
  let yesTotal = 0
  for (const r of items) {
    const yes = r.filter(Boolean).length
    const no = n - yes
    yesTotal += yes
    pBar += (yes * (yes - 1) + no * (no - 1)) / (n * (n - 1))
  }
  pBar /= N
  const pYes = yesTotal / (N * n)
  const pe = pYes * pYes + (1 - pYes) * (1 - pYes)
  if (pe === 1) return pBar === 1 ? 1 : 0
  return (pBar - pe) / (1 - pe)
}

/**
 * Wilson score interval for k successes in n trials. Used for the all-pass
 * rate when every task scores 0 or 1, where a percentile bootstrap collapses
 * (0 of 20 tasks would print "0–0"; Wilson gives 0–16%).
 */
export function wilsonCI(k: number, n: number, z = 1.959964): [number, number] {
  if (!n) return [NaN, NaN]
  const p = k / n
  const denom = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return [Math.max(0, centre - half), Math.min(1, centre + half)]
}
