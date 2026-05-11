# cgol-attention

Replicate [ctjLewis/EvolvingPrograms-turing](https://github.com/ctjLewis) tape methodology for Conway's Game of Life on Claude Opus 4.7.

**Hypothesis:** given a few-shot tape demonstrating the CGoL algorithm with full intermediate working (rule lookup table, 8-neighbor enumeration with source-coordinate binding, cumulative live-neighbor tally), the model generalizes to simulate B3/S23 on novel initial configurations for ≥3 steps with high accuracy.

See [JOURNAL.md](./JOURNAL.md) for chronological findings.

## Stack

TypeScript + Bun + `@anthropic-ai/sdk`. Uses `messages.stream()` (so output can exceed the SDK's non-streaming 21K-token guard) and prompt caching on the 3-shot prefix.

## Install

```bash
bun install
export ANTHROPIC_API_KEY=...   # https://console.anthropic.com/settings/keys
```

## Materialize training tapes

Writes `tapes/{block,blinker,glider}.txt` for inspection.

```bash
bun run build:tapes
```

## Run experiment

```bash
bun run run                                  # small suite (8 patterns), 1 trial each
bun run run -- --suite 10x10                 # 10×10 suite (4 patterns)
bun run run -- --trials 3                    # multiple trials (note: Opus 4.7 is
                                             #   deterministic; vary input instead)
bun run run -- --patterns toad,beacon        # subset
bun run run -- --concurrency 8               # parallel API calls
bun run run -- --out results/my-run
```

Output: `results/<ISO>/`:
- `config.json` — model, prompt, trial count
- `raw/<pattern>-<trial>.txt` — full model response per trial
- `raw/<pattern>-<trial>.meta.json` — stop_reason and usage (incl. cache hit/miss)
- `summary.json` — per-pattern strict pass rate, first-divergence stats, cell accuracy by step

## Tape format (v2)

Header (once per tape):

```
RULE B3/S23
LOOKUP
  live+0→░  live+1→░  live+2→█  live+3→█
  live+4→░  live+5→░  live+6→░  live+7→░  live+8→░
  dead+0→░  dead+1→░  dead+2→░  dead+3→█
  dead+4→░  dead+5→░  dead+6→░  dead+7→░  dead+8→░
BOUNDARY dead
```

Per step: visual `GRID t/N`, `INDEXED` row/col-labelled grid, `STEP t→t+1` block with one line per cell:

```
r2c2█: NW=r1c1░(0) N=r1c2█(1) NE=r1c3░(1) W=r2c1░(1) E=r2c3░(1) SW=r3c1░(1) S=r3c2█(2) SE=r3c3░(2) =2 live+2→█ r2c2█
```

Each neighbor is written as `{name}={src}{value}({tally})`. The source coordinate (e.g. `r1c1`) is a verbatim copy from the INDEXED block above — a same-token operation transformers do reliably via induction heads, which prevents the model from fabricating a neighbor value without "looking." Out-of-bounds is `oob░`. `(t)` is the running cumulative tally of live neighbors, forcing explicit counting (Lewis's dominant failure mode).

Then `NEW GRID t+1/N`. After the final step: `DONE` and `PRINT` rows re-emit each grid for context anchoring.

## Files

```
src/
  groundTruth.ts   vanilla B3/S23 simulator (boundary=dead)
  tape.ts          format + parse tape blocks
  training.ts      hand-authored few-shot examples (block, blinker, glider)
  patterns.ts      training + test pattern initial grids (small + 10×10 suites)
  run.ts           build prompt, stream API call w/ caching, parse NEW GRID blocks
  eval.ts          score one trial; summarize across trials
  main.ts          CLI entry
scripts/
  roundtrip.ts     verify formatTape → parse round-trips on test patterns
  diff_toad.ts     ad-hoc step-by-step diff inspection
tapes/             materialized training tapes (regenerable from training.ts)
results/<ISO>/     per-run output
```

## Success criteria

| Tier | Patterns | Bar | Result (v2, N=1) |
|------|----------|-----|------------------|
| 1 (baseline)     | block 2 steps         | ≥90% strict pass | met |
| 2 (oscillators)  | blinker/toad/beacon   | ≥80% strict pass for full period | met |
| 3 (spaceships)   | glider/LWSS 3 steps   | ≥50% strict pass | met |
| 4 (chaos)        | R-pentomino/soup 3 steps | ≥25% strict pass | met |
| stretch          | 10×10 / 2 steps       | n/a | 4/4 strict pass |

All test patterns pass strictly under the v2 tape. See JOURNAL.md for the v1 baseline (failed at toad/step 1 with one lookup error) and what changed.

## Cost notes

Opus 4.7 list pricing (as of running these): input $15/MTok, cache write $18.75/MTok (1.25×), cache read $1.50/MTok (0.1×), output $75/MTok.

Approximate per-call cost with the 3-shot prefix cached (~28K tokens):

| call | cache state | output tokens | rough ceiling |
|---|---|---|---|
| 6×6 / 2-step | cold | 8.8K | ~$1.20 |
| 6×6 / 2-step | warm | 8.8K | ~$0.70 |
| 6×6 / 3-step | warm | 13K | ~$1.05 |
| 7×7 / 2-step | warm | 12K | ~$0.95 |
| 10×10 / 2-step | warm | 24K | ~$1.85 |

These are back-of-envelope upper bounds using list rates. **Observed actual spend across the full set of runs documented in JOURNAL.md was ~$9 total** — roughly 2-3× less than these estimates suggest. Cache hits compound more than the simple model predicts, and output billing may not match list exactly for streaming.

Output dominates at every size and grows with cell count × step count. Sweep totals (rough upper bounds):
- small suite (8 patterns, N=1, one cold + 7 warm): ≲ $8
- 10×10 suite (4 patterns, N=1, all warm if run within 5 min of small sweep): ≲ $7.50

Caching saves ~$2-3 per sweep on the input side; it doesn't dent the output bill. Cache TTL is ~5 min, refreshed on each hit — running suites back-to-back keeps it warm.

**Opus 4.7 sampling is deterministic for a fixed prompt** (no `temperature` parameter accepted; fixed default sampling). Repeating the same trial produces bit-identical output, so multi-trial runs of the same pattern waste tokens. Vary the input (different soup seeds, different starting positions) to get a real distribution.

Check balance / top up: https://console.anthropic.com/settings/billing

## Known constraints

- **Streaming required above ~21K output tokens.** The SDK's non-streaming path throws if `max_tokens` could exceed a 10-minute completion budget. We use `messages.stream()` for everything to avoid the cliff.
- **`temperature` is deprecated** on Opus 4.7. API returns 400 if passed.

## v3 escape hatches

If accuracy fails on larger or longer test cases, in roughly increasing cost:
1. Drop the final `PRINT` pass to free output tokens.
2. Drop the visual `GRID` block between steps, keep only `INDEXED`.
3. Split the 8-neighbor count into row-by-row sub-tallies (3+2+3) with intermediate sub-totals.
4. Add a 4th few-shot tape (dual pattern in opposite corners) to force localization.
5. Reorder few-shot: glider → blinker → block (most complex first).
