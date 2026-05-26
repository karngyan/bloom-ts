/**
 * Karnstack BYOX: Bloom filter, TypeScript variant.
 *
 * The interface below is the contract karnstack tests target. Do not rename
 * the public methods. Implementation lives in this file across six stages:
 *
 *   Stage 1: bit array storage and a single hash function.
 *   Stage 2: multiple hash functions via the Kirsch-Mitzenmacher construction.
 *   Stage 3: optimal sizing helpers (m and k from a target false-positive rate).
 *   Stage 4: cache-line-blocked layout.
 *   Stage 5: concurrent-safe Add (best-effort in single-threaded JS; Web Workers extension is bonus).
 *   Stage 6: serialize, deserialize, and saturation estimation.
 *
 * Read the stage on karnstack.com/build/bloom-filter before implementing.
 */

const MASK64 = (1n << 64n) - 1n
const FNV64_OFFSET = 0xcbf29ce484222325n
const FNV64_PRIME = 0x100000001b3n
const BLOCK_BITS = 512
const BLOCK_WORDS = BLOCK_BITS / 64
const HEADER_SIZE = 4 + 8 + 8 + 1
const MAGIC = Uint8Array.of(0x42, 0x4c, 0x4d, 0x31) // "BLM1"
const PREFIX_DEADBEEF = Uint8Array.of(0xde, 0xad, 0xbe, 0xef)
const BLOCK_BITS_BIG = BigInt(BLOCK_BITS)

// Stafford variant 13 finalizer. Invertible, avalanches all 64 bits.
// Bare FNV-1a clusters block selection (stage 4) and deflates saturation
// (stage 6); the finalizer is the fix.
function splitmix64(x: bigint): bigint {
  x = x & MASK64
  x ^= x >> 33n
  x = (x * 0xff51afd7ed558ccdn) & MASK64
  x ^= x >> 33n
  x = (x * 0xc4ceb9fe1a85ec53n) & MASK64
  x ^= x >> 33n
  return x
}

function fnv1a64(prefix: Uint8Array | null, data: Uint8Array): bigint {
  let h = FNV64_OFFSET
  if (prefix) {
    for (let i = 0; i < prefix.length; i++) {
      h ^= BigInt(prefix[i])
      h = (h * FNV64_PRIME) & MASK64
    }
  }
  for (let i = 0; i < data.length; i++) {
    h ^= BigInt(data[i])
    h = (h * FNV64_PRIME) & MASK64
  }
  return h
}

function hashes(key: Uint8Array): [bigint, bigint] {
  const ha = splitmix64(fnv1a64(null, key))
  const hb = splitmix64(fnv1a64(PREFIX_DEADBEEF, key))
  return [ha, hb]
}

export class Filter {
  private bits: BigUint64Array = new BigUint64Array(0)
  private _m: number = 0
  private _k: number = 1
  private _blocked: boolean = false

  constructor(m: number, k: number = 1) {
    if (m === 0) m = 1
    if (k === 0) k = 1
    const words = Math.ceil(m / 64)
    this.bits = new BigUint64Array(words)
    this._m = words * 64
    this._k = k
  }

  add(key: Uint8Array): void {
    const [ha, hb] = hashes(key)
    const bits = this.bits
    const k = this._k
    if (this._blocked) {
      const blocks = BigInt(bits.length / BLOCK_WORDS)
      const base = Number(hb % blocks) * BLOCK_WORDS
      let acc = ha
      for (let i = 0; i < k; i++) {
        const pos = Number(acc % BLOCK_BITS_BIG)
        bits[base + (pos >> 6)] |= 1n << BigInt(pos & 63)
        acc = (acc + hb) & MASK64
      }
      return
    }
    const mBig = BigInt(this._m)
    let acc = ha
    for (let i = 0; i < k; i++) {
      const pos = Number(acc % mBig)
      bits[pos >> 6] |= 1n << BigInt(pos & 63)
      acc = (acc + hb) & MASK64
    }
  }

  test(key: Uint8Array): boolean {
    const [ha, hb] = hashes(key)
    const bits = this.bits
    const k = this._k
    if (this._blocked) {
      const blocks = BigInt(bits.length / BLOCK_WORDS)
      const base = Number(hb % blocks) * BLOCK_WORDS
      let acc = ha
      for (let i = 0; i < k; i++) {
        const pos = Number(acc % BLOCK_BITS_BIG)
        if ((bits[base + (pos >> 6)] & (1n << BigInt(pos & 63))) === 0n) {
          return false
        }
        acc = (acc + hb) & MASK64
      }
      return true
    }
    const mBig = BigInt(this._m)
    let acc = ha
    for (let i = 0; i < k; i++) {
      const pos = Number(acc % mBig)
      if ((bits[pos >> 6] & (1n << BigInt(pos & 63))) === 0n) {
        return false
      }
      acc = (acc + hb) & MASK64
    }
    return true
  }

  get m(): number {
    return this._m
  }

  get k(): number {
    return this._k
  }

  static blocked(m: number, k: number): Filter {
    if (m < BLOCK_BITS) m = BLOCK_BITS
    if (k === 0) k = 1
    const blocks = Math.ceil(m / BLOCK_BITS)
    const words = blocks * BLOCK_WORDS
    const inst = Object.create(Filter.prototype) as Filter
    ;(inst as { bits: BigUint64Array }).bits = new BigUint64Array(words)
    ;(inst as { _m: number })._m = blocks * BLOCK_BITS
    ;(inst as { _k: number })._k = k
    ;(inst as { _blocked: boolean })._blocked = true
    return inst
  }

  static optimalSize(n: number, p: number): { m: number; k: number } {
    if (n === 0) n = 1
    if (p <= 0 || p >= 1) p = 0.01
    const ln2 = Math.LN2
    const mFloat = (-n * Math.log(p)) / (ln2 * ln2)
    const m = Math.ceil(mFloat)
    const k = Math.max(1, Math.round((mFloat / n) * ln2))
    return { m, k }
  }

  toBytes(): Uint8Array {
    const buf = new Uint8Array(HEADER_SIZE + this.bits.length * 8)
    buf.set(MAGIC, 0)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    view.setBigUint64(4, BigInt(this._m), true)
    view.setBigUint64(12, BigInt(this._k), true)
    buf[20] = this._blocked ? 1 : 0
    for (let i = 0; i < this.bits.length; i++) {
      view.setBigUint64(HEADER_SIZE + i * 8, this.bits[i], true)
    }
    return buf
  }

  static fromBytes(data: Uint8Array): Filter {
    if (data.length < HEADER_SIZE) {
      throw new Error("bloom: data shorter than header")
    }
    if (
      data[0] !== MAGIC[0] ||
      data[1] !== MAGIC[1] ||
      data[2] !== MAGIC[2] ||
      data[3] !== MAGIC[3]
    ) {
      throw new Error("bloom: bad magic")
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const m = Number(view.getBigUint64(4, true))
    const k = Number(view.getBigUint64(12, true))
    const flags = data[20]
    const bodyLen = data.length - HEADER_SIZE
    if (bodyLen % 8 !== 0) {
      throw new Error("bloom: body not aligned to uint64")
    }
    const words = bodyLen / 8
    const bits = new BigUint64Array(words)
    for (let i = 0; i < words; i++) {
      bits[i] = view.getBigUint64(HEADER_SIZE + i * 8, true)
    }
    const inst = Object.create(Filter.prototype) as Filter
    ;(inst as { bits: BigUint64Array }).bits = bits
    ;(inst as { _m: number })._m = m
    ;(inst as { _k: number })._k = k
    ;(inst as { _blocked: boolean })._blocked = (flags & 1) !== 0
    return inst
  }

  saturation(): number {
    let set = 0
    for (let i = 0; i < this.bits.length; i++) {
      let w = this.bits[i]
      while (w !== 0n) {
        w &= w - 1n
        set++
      }
    }
    return set / this._m
  }
}
