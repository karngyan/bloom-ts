# karnstack/byox-bloom-filter-ts

Starter template (TypeScript) for the [Bloom Filter](https://karnstack.com/build/bloom-filter) primitive on karnstack.

Six stages. Paper-backed tests. You implement the interface; karnstack tells you what to read at each stage.

## Prerequisites

[mise](https://mise.jdx.dev/) is the only thing you need installed globally. It pins Node 24 and pnpm for this repo and runs the stage tasks. If you do not want to install mise, the equivalent commands are documented under [Without mise](#without-mise) below.

Install mise:

```bash
curl https://mise.run | sh
```

## Quick start

```bash
mise trust              # allow this repo's .mise.toml (one time)
mise install            # installs Node 24 + pnpm
mise run setup          # installs npm dependencies
mise run stage 1        # runs the tests for stage 1 (they fail until you implement)
```

Open [stage 1 on karnstack](https://karnstack.com/build/bloom-filter/01-bit-array-and-hashing). Implement `src/bloom.ts` until `mise run stage 1` passes. Then move on:

```bash
mise run stage 2
```

`mise run all` runs every stage at once.

## Layout

```
.
├── .mise.toml                            # toolchain + tasks
├── package.json
├── tsconfig.json
├── src/
│   └── bloom.ts                          # you implement here
└── tests/
    ├── stage01.bit-array.test.ts
    ├── stage02.multi-hash.test.ts
    ├── stage03.sizing.test.ts
    ├── stage04.blocked.test.ts
    ├── stage05.concurrent.test.ts
    └── stage06.serialize.test.ts
```

Each stage's tests live in their own file with a `describe("stageNN", ...)` block, so `vitest -t "^stageNN"` filters cleanly.

## Stages

1. Bit array and single hash
2. Multiple hashes (Kirsch-Mitzenmacher)
3. Optimal sizing math
4. Cache-line-blocked layout
5. Concurrent-safe Add (best-effort in single-threaded JS; Web Workers extension is bonus)
6. Serialize and saturation

Each stage is described on karnstack. Read first, then implement.

## What you are building

A constant-size data structure that says "definitely not in the set" or "maybe in the set" in `O(k)` time, with a tunable false-positive rate. The structure inside every production LSM-tree (RocksDB, LevelDB, Cassandra) used to skip disk reads on missing keys.

## Papers cited

- Bloom, B. (1970). [Space/Time Trade-offs in Hash Coding with Allowable Errors](https://dl.acm.org/doi/10.1145/362686.362692). CACM 13(7).
- Kirsch, A.; Mitzenmacher, M. (2006). [Less Hashing, Same Performance: Building a Better Bloom Filter](https://www.eecs.harvard.edu/~michaelm/postscripts/rsa2008.pdf). ESA 2006.
- Putze, F.; Sanders, P.; Singler, J. (2007). [Cache-, Hash- and Space-Efficient Bloom Filters](https://doi.org/10.1007/978-3-540-72845-0_9). WEA 2007.

## Without mise

If you do not want to install mise, ensure you have Node 24+ and pnpm installed and run:

```bash
pnpm install

# Stage 1
pnpm vitest run -t '^stage01'

# Stage N (replace 01 with the zero-padded stage number)
pnpm vitest run -t '^stageNN'

# All stages
pnpm vitest run
```

## License

MIT. See [LICENSE](LICENSE). Your fork is yours.
