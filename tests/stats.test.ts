import { describe, expect, test } from 'bun:test'
import { bootstrapMeanCI, cohenKappa, fleissKappa, mean, rng, wilsonCI } from '../src/stats'

describe('rng', () => {
  test('is deterministic for a seed and stays in [0, 1)', () => {
    const a = rng(42)
    const b = rng(42)
    const xs = Array.from({ length: 1000 }, () => a())
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()))
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThan(1)
    expect(Math.abs(mean(xs) - 0.5)).toBeLessThan(0.05)
  })
})

describe('bootstrapMeanCI', () => {
  test('brackets the mean and is reproducible', () => {
    const values = [0, 1, 1, 0, 1, 1, 1, 0, 1, 1]
    const ci = bootstrapMeanCI(values)
    expect(ci[0]).toBeLessThanOrEqual(mean(values))
    expect(ci[1]).toBeGreaterThanOrEqual(mean(values))
    expect(bootstrapMeanCI(values)).toEqual(ci)
    expect(ci[0]).toBeGreaterThanOrEqual(0)
    expect(ci[1]).toBeLessThanOrEqual(1)
  })

  test('collapses when every task scores the same, and widens with fewer tasks', () => {
    expect(bootstrapMeanCI([1, 1, 1, 1])).toEqual([1, 1])
    const few = bootstrapMeanCI([0, 1, 0, 1])
    const many = bootstrapMeanCI(Array.from({ length: 40 }, (_, i) => i % 2))
    expect(few[1] - few[0]).toBeGreaterThan(many[1] - many[0])
  })

  test('handles the degenerate sizes', () => {
    expect(bootstrapMeanCI([]).every(Number.isNaN)).toBe(true)
    expect(bootstrapMeanCI([0.7])).toEqual([0.7, 0.7])
  })
})

describe('cohenKappa', () => {
  test('is 1 for perfect agreement and 0 for chance-level agreement', () => {
    expect(cohenKappa([true, false, true, false], [true, false, true, false])).toBe(1)
    // a always yes; b half yes → agreement is exactly what chance predicts
    expect(cohenKappa([true, true, true, true], [true, false, true, false])).toBeCloseTo(0, 10)
  })

  test('matches a hand-computed value', () => {
    // 2x2: both yes 20, a yes/b no 5, a no/b yes 10, both no 15 → po = 0.7, pe = 0.5 → κ = 0.4
    const a = [...Array(20).fill(true), ...Array(5).fill(true), ...Array(10).fill(false), ...Array(15).fill(false)]
    const b = [...Array(20).fill(true), ...Array(5).fill(false), ...Array(10).fill(true), ...Array(15).fill(false)]
    expect(cohenKappa(a, b)).toBeCloseTo(0.4, 10)
  })

  test('rejects mismatched raters', () => {
    expect(() => cohenKappa([true], [true, false])).toThrow()
  })
})

describe('fleissKappa', () => {
  test('is 1 when raters always agree (with both categories used)', () => {
    expect(fleissKappa([[true, true, true], [false, false, false], [true, true, true]])).toBe(1)
  })

  test('matches a hand-computed value', () => {
    // 4 items × 3 raters. yes-counts 3, 2, 1, 0.
    // P_i = 1, 1/3, 1/3, 1 → P̄ = 2/3; p_yes = 6/12 = 0.5 → Pe = 0.5 → κ = (2/3 − 1/2)/(1/2) = 1/3
    const items = [
      [true, true, true],
      [true, true, false],
      [true, false, false],
      [false, false, false],
    ]
    expect(fleissKappa(items)).toBeCloseTo(1 / 3, 10)
  })

  test('needs equal rater counts', () => {
    expect(() => fleissKappa([[true, false], [true]])).toThrow()
    expect(() => fleissKappa([[true]])).toThrow()
  })
})

describe('wilsonCI', () => {
  test('gives a real interval where the bootstrap collapses', () => {
    const [lo, hi] = wilsonCI(0, 20)
    expect(lo).toBe(0)
    expect(hi).toBeCloseTo(0.1611, 3)
    const [lo2, hi2] = wilsonCI(20, 20)
    expect(lo2).toBeCloseTo(0.8389, 3)
    expect(hi2).toBe(1)
  })

  test('matches a textbook value', () => {
    const [lo, hi] = wilsonCI(7, 20) // p = 0.35
    expect(lo).toBeCloseTo(0.1812, 3)
    expect(hi).toBeCloseTo(0.5671, 3)
  })
})
