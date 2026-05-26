// Tests for Stage 5: concurrent-safe add.
//
// Read the stage on karnstack.com/build/bloom-filter/05-concurrent-add
// before debugging failures. JS is single-threaded; this test races N
// async tasks via Promise.all to verify the API holds up when many
// Adds interleave at the event-loop level. For real parallelism, Web
// Workers extension is bonus.

import { describe, test, expect } from "vitest"
import { Filter } from "../src/bloom"

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe("stage05", () => {
  test("ConcurrentAddAllKeysPresent", async () => {
    const workers = 100
    const keysPerWorker = 100
    const f = new Filter(95850, 7)
    await Promise.all(
      Array.from({ length: workers }, (_, w) =>
        (async () => {
          for (let i = 0; i < keysPerWorker; i++) {
            f.add(utf8(`w${w}-k${i}`))
          }
        })()
      )
    )
    for (let w = 0; w < workers; w++) {
      for (let i = 0; i < keysPerWorker; i++) {
        expect(f.test(utf8(`w${w}-k${i}`))).toBe(true)
      }
    }
  }, 30_000)

  test("ConcurrentAddOnBlockedFilter", async () => {
    const workers = 50
    const f = Filter.blocked(95850, 7)
    await Promise.all(
      Array.from({ length: workers }, (_, w) =>
        (async () => {
          for (let i = 0; i < 100; i++) {
            f.add(utf8(`blocked-w${w}-k${i}`))
          }
        })()
      )
    )
    for (let w = 0; w < workers; w++) {
      for (let i = 0; i < 100; i++) {
        expect(f.test(utf8(`blocked-w${w}-k${i}`))).toBe(true)
      }
    }
  }, 30_000)
})
