#!/usr/bin/env bash
# Parse `vitest run --reporter=verbose` output and emit JSON:
#
#   {"passing_stages": [1, 2, 3]}
#
# vitest verbose lines look like:
#   ✓ tests/stage01.bit-array.test.ts > stage01 > EmptyFilterReturnsFalse
#   × tests/stage01.bit-array.test.ts > stage01 > AddedKeyIsPresent
#
# A stage passes only when every "stageNN > <case>" line for that
# stage reports ✓. Any × on a stageNN case fails that stage.
#
# Portable across bash 3.2 (macOS) and bash 4+ (Linux).

set -euo pipefail

LOG="${1:-/dev/stdin}"
TMP=$(mktemp -t parse-stages.XXXXXX)
trap 'rm -f "$TMP"' EXIT

# Extract one line per (RESULT, NN). U+2713 (✓) = pass, U+00D7 (×) = fail.
# Skip-marker (↓) and todo (·) are not considered.
grep -E '^[[:space:]]*(✓|×)[[:space:]].*>[[:space:]]*stage[0-9]{2}[[:space:]]*>' "$LOG" \
  | sed -E 's/^[[:space:]]*(✓|×)[[:space:]].*>[[:space:]]*stage([0-9]{2})[[:space:]]*>.*/\1 \2/' \
  | sed -E 's/^✓/PASS/; s/^×/FAIL/' \
  > "$TMP" || true

FAILED=$(awk '$1=="FAIL" {print $2}' "$TMP" | sort -u)
SEEN=$(awk '{print $2}' "$TMP" | sort -u)

if [ -z "$SEEN" ]; then
  echo '{"passing_stages": []}'
  exit 0
fi

PASSING=$(comm -23 <(printf '%s\n' "$SEEN") <(printf '%s\n' "$FAILED"))

if [ -z "$PASSING" ]; then
  echo '{"passing_stages": []}'
  exit 0
fi

printf '%s\n' "$PASSING" \
  | sed -E 's/^0+//' \
  | sort -n \
  | jq -R 'tonumber' \
  | jq -sc '{passing_stages: .}'
