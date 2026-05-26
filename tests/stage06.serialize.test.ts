// Tests for Stage 6: serialize, deserialize, and saturation estimation.
//
// Read the stage on karnstack.com/build/bloom-filter/06-serialize-and-saturation
// before debugging failures.

import { describe, test, expect } from "vitest"
import { Filter } from "../src/bloom"

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe("stage06", () => {
  test("RoundTripPreservesMembership", () => {
    const src = new Filter(95850, 7)
    const n = 5000
    for (let i = 0; i < n; i++) src.add(utf8(`key-${i}`))

    const data = src.toBytes()
    expect(data.length).toBeGreaterThan(0)

    const dst = Filter.fromBytes(data)
    expect(dst.m).toBe(src.m)
    expect(dst.k).toBe(src.k)

    for (let i = 0; i < n; i++) {
      const key = utf8(`key-${i}`)
      expect(src.test(key)).toBe(dst.test(key))
    }
  })

  test("SerializationIsDeterministic", () => {
    const f = new Filter(1024, 4)
    for (const k of ["a", "b", "c"].map(utf8)) f.add(k)
    const a = f.toBytes()
    const b = f.toBytes()
    expect(a.length).toBe(b.length)
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toBe(b[i])
    }
  })

  test("SaturationTracksTheoretical", () => {
    const m = 95850
    const k = 7
    const n = 10000
    const f = new Filter(m, k)
    for (let i = 0; i < n; i++) f.add(utf8(`key-${i}`))
    const observed = f.saturation()
    const theoretical = 1 - Math.exp((-k * n) / m)
    const delta = Math.abs(observed - theoretical) / theoretical
    expect(delta).toBeLessThanOrEqual(0.05)
  })
})
