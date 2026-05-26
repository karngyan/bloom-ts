// Tests for Stage 3: optimal sizing math.
//
// Read the stage on karnstack.com/build/bloom-filter/03-optimal-sizing-math
// before debugging failures.

import { describe, test, expect } from "vitest"
import { Filter } from "../src/bloom"

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe("stage03", () => {
  // Filter.optimalSize(10000, 0.01) yields m around 95850 and k around 7.
  // 5% slack on m, +-1 on k.
  test("OptimalSizeAt10kKeysOnePercent", () => {
    const { m, k } = Filter.optimalSize(10000, 0.01)
    expect(m).toBeGreaterThan(0)
    expect(k).toBeGreaterThan(0)
    const expectedM = 95850
    const mDelta = Math.abs(m - expectedM) / expectedM
    expect(mDelta).toBeLessThanOrEqual(0.05)
    expect(k).toBeGreaterThanOrEqual(6)
    expect(k).toBeLessThanOrEqual(8)
  })

  // Spot-check varied (n, p) values; catches a base-10 log substitution.
  test.each([
    { n: 1000, p: 0.01, wantBitsPerKey: 9.585 },
    { n: 1000, p: 0.001, wantBitsPerKey: 14.377 },
    { n: 1000, p: 0.0001, wantBitsPerKey: 19.17 },
    { n: 100000, p: 0.01, wantBitsPerKey: 9.585 },
  ])("OptimalSizeAtVariedRates n=$n p=$p", ({ n, p, wantBitsPerKey }) => {
    const { m } = Filter.optimalSize(n, p)
    const got = m / n
    const delta = Math.abs(got - wantBitsPerKey) / wantBitsPerKey
    expect(delta).toBeLessThanOrEqual(0.05)
  })

  // Wire the output back into Filter(m, k) and verify FP rate <= 2 * p.
  test("OptimalSizeProducesUsableFilter", () => {
    const n = 10000
    const p = 0.01
    const trials = 100000
    const { m, k } = Filter.optimalSize(n, p)
    const f = new Filter(m, k)
    for (let i = 0; i < n; i++) f.add(utf8(`added-${i}`))
    let fps = 0
    for (let i = 0; i < trials; i++) {
      if (f.test(utf8(`query-${i}`))) fps++
    }
    expect(fps / trials).toBeLessThanOrEqual(2 * p)
  }, 30_000)
})
