# cgol-attention

Replicate [ctjLewis/EvolvingPrograms-turing](https://github.com/ctjLewis) tape methodology for Conway's Game of Life on Claude Opus 4.7.

**Hypothesis:** given a few-shot tape demonstrating the CGoL algorithm with full intermediate working (rule lookup table, 8-neighbor enumeration, cumulative live-neighbor tally), the model generalizes to simulate B3/S23 on novel initial configurations for ≥3 steps with high accuracy.

## Stack

TypeScript + Bun + `@anthropic-ai/sdk`.

## Install

```bash
bun install
export ANTHROPIC_API_KEY=...
```

## Materialize training tapes

Writes `tapes/{block,blinker,glider}.txt` for inspection.

```bash
bun run build:tapes
```

## Run experiment

```bash
bun run run                              # all test patterns, 10 trials each
bun run run -- --trials 3                # fewer trials
bun run run -- --patterns toad,beacon    # subset
bun run run -- --concurrency 8           # parallel API calls
bun run run -- --out results/my-run
```

Output: `results/<ISO>/`:
- `config.json` — model, prompt, trial count
- `raw/<pattern>-<trial>.txt` — full model response per trial
- `summary.json` — per-pattern strict pass rate, first-divergence stats, cell accuracy by step

## Tape format

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
r2c2█: NW░(0) N█(1) NE░(1) W░(1) E░(1) SW░(1) S█(2) SE░(2) =2 live+2→█ r2c2█
```

`(t)` is the running cumulative tally of live neighbors — forces explicit counting (Lewis's dominant failure mode). Then `NEW GRID t+1/N`. Final `DONE` and `PRINT` rows re-emit each grid through context.

## Files

```
src/
  groundTruth.ts   vanilla B3/S23 simulator (boundary=dead)
  tape.ts          format + parse tape blocks
  training.ts      hand-authored few-shot examples (block, blinker, glider)
  patterns.ts      training + test pattern initial grids
  run.ts           build prompt, call API, parse NEW GRID blocks
  eval.ts          score one trial; summarize across trials
  main.ts          CLI entry
```

## Success criteria

| Tier | Patterns | Bar |
|------|----------|-----|
| 1 (baseline)     | block 2 steps         | ≥90% strict pass |
| 2 (oscillators)  | blinker/toad/beacon   | ≥80% strict pass for full period |
| 3 (spaceships)   | glider/LWSS 3 steps   | ≥50% strict pass |
| 4 (chaos)        | R-pentomino/soup 3 steps | ≥25% strict pass |

## v2 escape hatches

If accuracy is poor, in order of cost:
1. Drop final `PRINT` pass to free output tokens.
2. Drop visual `GRID` block, keep only `INDEXED`.
3. Split 8-neighbor count into N-half/S-half sub-tallies.
4. Mark out-of-bounds explicitly: `NW(oob)░`.
5. Add a 4th few-shot tape (dual pattern in opposite corners).
6. Reorder few-shot: glider → blinker → block (most complex first).
