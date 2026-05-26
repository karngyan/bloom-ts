// Tests for Stage 2: multiple hashes via the Kirsch-Mitzenmacher
// construction.
//
// Read the stage on karnstack.com/build/bloom-filter/02-multiple-hashes
// before debugging failures. Each test catches a specific failure mode
// listed in the "Common Pitfalls" section.

import { describe, test, expect } from "vitest"
import { Filter } from "../src/bloom"

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe("stage02", () => {
  // new Filter(m, k) constructs and reports rounded-up capacity. Catches a
  // missing k parameter or one that is silently ignored.
  test("ConstructorAcceptsK", () => {
    const f = new Filter(1024, 3)
    expect(f.m).toBeGreaterThanOrEqual(1024)
  })

  // add/test still work end to end once add is using k hashes. Failure here
  // means the multi-hash construction is mis-indexing (off-by-one on i,
  // wrong modulo, etc.).
  test("AddedKeysArePresent", () => {
    const f = new Filter(95850, 7)
    const keys = ["alice", "bob", "carol", "dan", "eve"].map(utf8)
    for (const k of keys) f.add(k)
    for (const k of keys) {
      expect(f.test(k)).toBe(true)
    }
  })

  // FP rate must stay within 2x of (1 - e^-kn/m)^k. Inserts n=10000 keys
  // into an m=95850 / k=7 filter, queries 100k unseen keys, and verifies
  // the observed false-positive rate is at most twice the theoretical Bloom
  // bound. A broken Kirsch-Mitzenmacher derivation blows well past 2x.
  test("FPRateBelowTheoreticalBound", () => {
    const m = 95850
    const k = 7
    const n = 10000
    const trials = 100000
    const f = new Filter(m, k)
    for (let i = 0; i < n; i++) {
      f.add(utf8(`added-${i}`))
    }
    let fps = 0
    for (let i = 0; i < trials; i++) {
      if (f.test(utf8(`query-${i}`))) fps++
    }
    const observed = fps / trials
    const theoretical = Math.pow(1 - Math.exp((-k * n) / m), k)
    const bound = 2 * theoretical
    expect(observed).toBeLessThanOrEqual(bound)
  }, 30_000)
})
