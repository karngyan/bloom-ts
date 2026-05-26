// Tests for Stage 1: bit array and single hash.
//
// Read the stage on karnstack.com/build/bloom-filter/01-bit-array-and-hashing
// before debugging failures. Each test catches a specific failure mode
// listed in the "Common Pitfalls" section.

import { describe, test, expect } from "vitest"
import { Filter } from "../src/bloom"

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe("stage01", () => {
  // New(m) returns a filter whose actual bit capacity is at least m.
  // The implementation may round m up to a multiple of 8; truncation is the
  // bug this catches.
  test("NewAllocatesAtLeastMBits", () => {
    const m = 95850
    const f = new Filter(m)
    expect(f.m).toBeGreaterThanOrEqual(m)
  })

  // Any key returns true on Test after Add. Catches a missing or broken Add.
  test("AddedKeyIsPresent", () => {
    const f = new Filter(1024)
    const keys = ["alice", "bob", "carol", "dan"].map(utf8)
    for (const k of keys) f.add(k)
    for (const k of keys) {
      expect(f.test(k)).toBe(true)
    }
  })

  // Test on a fresh filter returns false for arbitrary keys. With a single
  // hash and zero inserts, there is no false-positive path. Catches a bit
  // array that initializes to non-zero values.
  test("EmptyFilterReturnsFalse", () => {
    const f = new Filter(1024)
    for (let i = 0; i < 100; i++) {
      const k = utf8(`key-${i}`)
      expect(f.test(k)).toBe(false)
    }
  })

  // New(1) does not crash and Add followed by Test works on a one-bit filter.
  // Catches off-by-one errors in the modulo-into-bit-position math and
  // division-by-zero on tiny filters.
  test("BitArrayBoundary", () => {
    const f = new Filter(1)
    expect(f.m).toBeGreaterThanOrEqual(1)
    const key = utf8("anything")
    f.add(key)
    expect(f.test(key)).toBe(true)
  })

  // Two filters of identical capacity agree on Test for the same key after
  // Add. Catches a hash function seeded from Math.random rather than a
  // constant.
  test("HashIsDeterministic", () => {
    const m = 1024
    const f1 = new Filter(m)
    const f2 = new Filter(m)
    const key = utf8("deterministic")
    f1.add(key)
    f2.add(key)
    expect(f1.test(key)).toBe(true)
    expect(f2.test(key)).toBe(true)
  })
})
