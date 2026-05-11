# CGoL tape format — input + output

Adapting the tape methodology to 2D Conway's GoL on claude-opus-4-7.
All 4 tested 10×10 patterns (1 LWSS + 3 random soups at 30/30/40%
density) gave 100% strict cell-accuracy for 2 steps in one shot — no
spatial decomposition, the whole 10×10 grid is enumerated in a single
tape.

Code: <repo URL>

## Prompt structure

System (constant):

> You are simulating Conway's Game of Life (rule B3/S23, boundary=dead).
> Follow the exact tape format shown in the examples: emit the LOOKUP
> header, then for each step emit GRID t/N, INDEXED, STEP t→t+1 with one
> line per cell enumerating all 8 neighbors with cumulative live tally,
> and NEW GRID t+1/N. For each neighbor, write its source coordinate and
> value (e.g. NW=r2c2█) copied from the INDEXED block. Out-of-bounds
> neighbors are written as `oob░`. Compute every cell explicitly. Do
> not skip cells. Do not summarize.

Then 3 few-shot user/assistant turns (block 4×4 / 2-step, blinker 5×5 /
2-step, glider 6×6 / 4-step), then the test user turn. The 3-shot
prefix (~28K tokens) is identical across all trials and prompt-cached.

## Per-cell line schema

```
{cell_label}: NW={src}{v}({t}) N={src}{v}({t}) NE={src}{v}({t}) W={src}{v}({t}) E={src}{v}({t}) SW={src}{v}({t}) S={src}{v}({t}) SE={src}{v}({t}) ={final} {state}+{final}→{new} r{r}c{c}{new}
```

- `{cell_label}` = `r{row}c{col}` + current value (░/█)
- `{src}` = neighbor source coordinate (e.g. `r2c2`), or `oob` for
  out-of-bounds
- `{v}` = neighbor value (░ for OOB, since boundary=dead)
- `{t}` = running cumulative tally of live neighbors so far
- `{final}` = total live neighbors (must equal final tally)
- `{state}` = `live` / `dead` (center cell)
- `{new}` = result of `{state}+{final}` from the LOOKUP table

The `NW=r2c2█` binding is the key v2 change vs the first attempt
(which used just `NW█`). It forces the value token to follow a source
coordinate that the model must copy verbatim from the INDEXED block —
an induction-head-friendly operation. Without it, on a 6×6 toad the
model fabricated `NW░` when the source was `█` — a single attention
error that propagated through the neighborhood.

## Full training example — blinker 5×5 / 2 steps

### USER

```
SIZE 5x5
STEPS 2
GRID 0/2
r0: ░ ░ ░ ░ ░
r1: ░ ░ ░ ░ ░
r2: ░ █ █ █ ░
r3: ░ ░ ░ ░ ░
r4: ░ ░ ░ ░ ░
```

### ASSISTANT

```
RULE B3/S23
LOOKUP
  live+0→░  live+1→░  live+2→█  live+3→█
  live+4→░  live+5→░  live+6→░  live+7→░  live+8→░
  dead+0→░  dead+1→░  dead+2→░  dead+3→█
  dead+4→░  dead+5→░  dead+6→░  dead+7→░  dead+8→░
BOUNDARY dead
GRID 0/2
r0: ░ ░ ░ ░ ░
r1: ░ ░ ░ ░ ░
r2: ░ █ █ █ ░
r3: ░ ░ ░ ░ ░
r4: ░ ░ ░ ░ ░
INDEXED
r0c0░ r0c1░ r0c2░ r0c3░ r0c4░
r1c0░ r1c1░ r1c2░ r1c3░ r1c4░
r2c0░ r2c1█ r2c2█ r2c3█ r2c4░
r3c0░ r3c1░ r3c2░ r3c3░ r3c4░
r4c0░ r4c1░ r4c2░ r4c3░ r4c4░
STEP 0→1
r0c0░: NW=oob░(0) N=oob░(0) NE=oob░(0) W=oob░(0) E=r0c1░(0) SW=oob░(0) S=r1c0░(0) SE=r1c1░(0) =0 dead+0→░ r0c0░
r0c1░: NW=oob░(0) N=oob░(0) NE=oob░(0) W=r0c0░(0) E=r0c2░(0) SW=r1c0░(0) S=r1c1░(0) SE=r1c2░(0) =0 dead+0→░ r0c1░
r0c2░: NW=oob░(0) N=oob░(0) NE=oob░(0) W=r0c1░(0) E=r0c3░(0) SW=r1c1░(0) S=r1c2░(0) SE=r1c3░(0) =0 dead+0→░ r0c2░
r0c3░: NW=oob░(0) N=oob░(0) NE=oob░(0) W=r0c2░(0) E=r0c4░(0) SW=r1c2░(0) S=r1c3░(0) SE=r1c4░(0) =0 dead+0→░ r0c3░
r0c4░: NW=oob░(0) N=oob░(0) NE=oob░(0) W=r0c3░(0) E=oob░(0) SW=r1c3░(0) S=r1c4░(0) SE=oob░(0) =0 dead+0→░ r0c4░
r1c0░: NW=oob░(0) N=r0c0░(0) NE=r0c1░(0) W=oob░(0) E=r1c1░(0) SW=oob░(0) S=r2c0░(0) SE=r2c1█(1) =1 dead+1→░ r1c0░
r1c1░: NW=r0c0░(0) N=r0c1░(0) NE=r0c2░(0) W=r1c0░(0) E=r1c2░(0) SW=r2c0░(0) S=r2c1█(1) SE=r2c2█(2) =2 dead+2→░ r1c1░
r1c2░: NW=r0c1░(0) N=r0c2░(0) NE=r0c3░(0) W=r1c1░(0) E=r1c3░(0) SW=r2c1█(1) S=r2c2█(2) SE=r2c3█(3) =3 dead+3→█ r1c2█
r1c3░: NW=r0c2░(0) N=r0c3░(0) NE=r0c4░(0) W=r1c2░(0) E=r1c4░(0) SW=r2c2█(1) S=r2c3█(2) SE=r2c4░(2) =2 dead+2→░ r1c3░
r1c4░: NW=r0c3░(0) N=r0c4░(0) NE=oob░(0) W=r1c3░(0) E=oob░(0) SW=r2c3█(1) S=r2c4░(1) SE=oob░(1) =1 dead+1→░ r1c4░
r2c0░: NW=oob░(0) N=r1c0░(0) NE=r1c1░(0) W=oob░(0) E=r2c1█(1) SW=oob░(1) S=r3c0░(1) SE=r3c1░(1) =1 dead+1→░ r2c0░
r2c1█: NW=r1c0░(0) N=r1c1░(0) NE=r1c2░(0) W=r2c0░(0) E=r2c2█(1) SW=r3c0░(1) S=r3c1░(1) SE=r3c2░(1) =1 live+1→░ r2c1░
r2c2█: NW=r1c1░(0) N=r1c2░(0) NE=r1c3░(0) W=r2c1█(1) E=r2c3█(2) SW=r3c1░(2) S=r3c2░(2) SE=r3c3░(2) =2 live+2→█ r2c2█
r2c3█: NW=r1c2░(0) N=r1c3░(0) NE=r1c4░(0) W=r2c2█(1) E=r2c4░(1) SW=r3c2░(1) S=r3c3░(1) SE=r3c4░(1) =1 live+1→░ r2c3░
r2c4░: NW=r1c3░(0) N=r1c4░(0) NE=oob░(0) W=r2c3█(1) E=oob░(1) SW=r3c3░(1) S=r3c4░(1) SE=oob░(1) =1 dead+1→░ r2c4░
r3c0░: NW=oob░(0) N=r2c0░(0) NE=r2c1█(1) W=oob░(1) E=r3c1░(1) SW=oob░(1) S=r4c0░(1) SE=r4c1░(1) =1 dead+1→░ r3c0░
r3c1░: NW=r2c0░(0) N=r2c1█(1) NE=r2c2█(2) W=r3c0░(2) E=r3c2░(2) SW=r4c0░(2) S=r4c1░(2) SE=r4c2░(2) =2 dead+2→░ r3c1░
r3c2░: NW=r2c1█(1) N=r2c2█(2) NE=r2c3█(3) W=r3c1░(3) E=r3c3░(3) SW=r4c1░(3) S=r4c2░(3) SE=r4c3░(3) =3 dead+3→█ r3c2█
r3c3░: NW=r2c2█(1) N=r2c3█(2) NE=r2c4░(2) W=r3c2░(2) E=r3c4░(2) SW=r4c2░(2) S=r4c3░(2) SE=r4c4░(2) =2 dead+2→░ r3c3░
r3c4░: NW=r2c3█(1) N=r2c4░(1) NE=oob░(1) W=r3c3░(1) E=oob░(1) SW=r4c3░(1) S=r4c4░(1) SE=oob░(1) =1 dead+1→░ r3c4░
r4c0░: NW=oob░(0) N=r3c0░(0) NE=r3c1░(0) W=oob░(0) E=r4c1░(0) SW=oob░(0) S=oob░(0) SE=oob░(0) =0 dead+0→░ r4c0░
r4c1░: NW=r3c0░(0) N=r3c1░(0) NE=r3c2░(0) W=r4c0░(0) E=r4c2░(0) SW=oob░(0) S=oob░(0) SE=oob░(0) =0 dead+0→░ r4c1░
r4c2░: NW=r3c1░(0) N=r3c2░(0) NE=r3c3░(0) W=r4c1░(0) E=r4c3░(0) SW=oob░(0) S=oob░(0) SE=oob░(0) =0 dead+0→░ r4c2░
r4c3░: NW=r3c2░(0) N=r3c3░(0) NE=r3c4░(0) W=r4c2░(0) E=r4c4░(0) SW=oob░(0) S=oob░(0) SE=oob░(0) =0 dead+0→░ r4c3░
r4c4░: NW=r3c3░(0) N=r3c4░(0) NE=oob░(0) W=r4c3░(0) E=oob░(0) SW=oob░(0) S=oob░(0) SE=oob░(0) =0 dead+0→░ r4c4░
NEW GRID 1/2
r0: ░ ░ ░ ░ ░
r1: ░ ░ █ ░ ░
r2: ░ ░ █ ░ ░
r3: ░ ░ █ ░ ░
r4: ░ ░ ░ ░ ░
GRID 1/2
... (STEP 1→2 block omitted for brevity, same shape) ...
NEW GRID 2/2
r0: ░ ░ ░ ░ ░
r1: ░ ░ ░ ░ ░
r2: ░ █ █ █ ░
r3: ░ ░ ░ ░ ░
r4: ░ ░ ░ ░ ░
DONE
PRINT 0/2 ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ █ █ █ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
PRINT 1/2 ░ ░ ░ ░ ░ ░ ░ █ ░ ░ ░ ░ █ ░ ░ ░ ░ █ ░ ░ ░ ░ ░ ░ ░
PRINT 2/2 ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ █ █ █ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
```

That's the full pattern — one row per cell, 8 neighbors enumerated
with source coords, cumulative tally in parens, lookup application,
write-back. Glider 6×6/4 follows the same shape but bigger.

## Test input — LWSS in a 10×10

User message:

```
SIZE 10x10
STEPS 2
GRID 0/2
r0: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r1: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r2: ░ ░ █ ░ ░ █ ░ ░ ░ ░
r3: ░ ░ ░ ░ ░ ░ █ ░ ░ ░
r4: ░ ░ █ ░ ░ ░ █ ░ ░ ░
r5: ░ ░ ░ █ █ █ █ ░ ░ ░
r6: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r7: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r8: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r9: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
```

## Test output — last 12 lines + final grid

(Full output = 24,298 tokens, all 200 cell lines emitted with correct
neighbors. Here's the tail to show it terminates correctly.)

```
... [STEP 1→2, cells through r9c8] ...
r9c9░: NW=r8c8░(0) N=r8c9░(0) NE=oob░(0) W=r9c8░(0) E=oob░(0) SW=oob░(0) S=oob░(0) SE=oob░(0) =0 dead+0→░ r9c9░
NEW GRID 2/2
r0: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r1: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r2: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r3: ░ ░ ░ ░ █ █ █ █ ░ ░
r4: ░ ░ ░ █ ░ ░ ░ █ ░ ░
r5: ░ ░ ░ ░ ░ ░ ░ █ ░ ░
r6: ░ ░ ░ █ ░ ░ █ ░ ░ ░
r7: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r8: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
r9: ░ ░ ░ ░ ░ ░ ░ ░ ░ ░
DONE
PRINT 0/2 ...
PRINT 1/2 ...
PRINT 2/2 ...
```

Strict bit-for-bit match against the ground-truth simulator on every
cell of every step. (LWSS is period-4 and only returns to its original
shape after 4 steps; the step-2 state shown above is the mirrored
intermediate phase.)

## Caveats

1. Only 2 steps. "Too deep" likely means depth-in-time. 10×10 over 5+
   steps, where errors can compound across iterations, is untested.
2. Only 4 patterns at 10×10. Possible the seeds chosen happened to be
   easy. Adversarial seeds (lots of cells near the survival/birth
   boundary at 2/3 live neighbors) might be harder.
3. Only one model (Opus 4.7). The format may be doing less work than
   the raw model strength.
4. v1 (without the `NW=r2c2█` source-coord binding) failed at 6×6
   toad/2-step with one lookup error. The binding is doing real work
   — it's not free, and likely the piece doing the heavy lifting at
   scale.

Next experiment: 10×10 over 5+ steps. That should either vindicate or
refute the "too deep" prediction.
