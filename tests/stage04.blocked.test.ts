// Tests for Stage 4: cache-line-blocked layout.
//
// Read the stage on karnstack.com/build/bloom-filter/04-cache-line-blocked
// before debugging failures. JS has no cache-tuning knob, so this stage
// is mostly informative; the FP-rate property still holds.

import { describe, test, expect } from "vitest"
import { Filter } from "../src/bloom"

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe("stage04", () => {
  test("BlockedAllocates", () => {
    const f = Filter.blocked(95850, 7)
    expect(f.m).toBeGreaterThanOrEqual(95850)
    expect(f.k).toBe(7)
  })

  test("AddedKeysArePresent", () => {
    const f = Filter.blocked(95850, 7)
    const keys = ["alice", "bob", "carol", "dan", "eve", "frank"].map(utf8)
    for (const k of keys) f.add(k)
    for (const k of keys) {
      expect(f.test(k)).toBe(true)
    }
  })

  test("FPRateBelowTheoreticalBound", () => {
    const m = 95850
    const k = 7
    const n = 10000
    const trials = 100000
    const f = Filter.blocked(m, k)
    for (let i = 0; i < n; i++) f.add(utf8(`added-${i}`))
    let fps = 0
    for (let i = 0; i < trials; i++) {
      if (f.test(utf8(`query-${i}`))) fps++
    }
    const observed = fps / trials
    const theoretical = Math.pow(1 - Math.exp((-k * n) / m), k)
    expect(observed).toBeLessThanOrEqual(2 * theoretical)
  }, 30_000)
})
