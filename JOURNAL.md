# Experiment Journal

Chronological log of runs, findings, and decisions for the CGoL-via-attention test.
Each entry: date, what changed, what we ran, what we observed.

---

## 2026-05-11 — v1: baseline tape (initial implementation)

**Tape format:** per-cell line lists 8 neighbors as `NW{v}(t)` where `{v}` is the
neighbor value and `(t)` is the cumulative live tally. Source coordinate is *not*
written.

**Smoke test:** toad pattern, 6×6, 2 steps, 1 trial, claude-opus-4-7.

**Result:** strict pass = 0%. First divergence at step 1.

| step | cell accuracy | strict |
|---|---|---|
| 0 | 100.0% | yes (just echo) |
| 1 |  97.2% | no — 1 cell wrong (r3c3) |
| 2 |  83.3% | no — error propagated to 6 cells |

**Failure analysis:** for cell r3c3 (live), the model emitted
`NW░(0) N█(1) NE█(2) W█(3) E░(3) SW░(3) S░(3) SE░(3) =3 live+3→█`.
But truth: r2c2 (the NW neighbor) is `█`, not `░`. The model wrote the wrong
value for its NW neighbor — a **lookup error**, not an arithmetic error. The
arithmetic was internally consistent with its (wrong) inputs.

**Hypothesis:** the v1 format lets the model fabricate `NW░` without actually
attending to the source cell. There's no token in the per-cell line that has to
match a token in the INDEXED block above. Cost: one bad attention per ~36 cells
propagates to a full step failure.

**Side findings:**
- API: `temperature` is deprecated on Opus 4.7 (400 invalid_request_error).
  Model now uses fixed default sampling.
- Cost: ~5K input + ~2.3K output ≈ $0.25 for this trial.

---

## 2026-05-11 — v2: source-coord marking

**Change:** per-cell line now writes `NW=r2c2█(0)` instead of `NW░(0)`. The
neighbor value is bound to its source coordinate. OOB written as `=oob░`. The
model must emit a token (`r2c2█`) that appears verbatim in the INDEXED block
— a same-token copy operation that induction heads do reliably.

**Cost trade-off:** per-cell line ~30% longer. Output bloated past 8192-token
cap on toad/2-step. Bumped `MAX_TOKENS` to 16384.

**Smoke test:** toad, 1 trial.

**Result:** **100% strict pass.** All 36 cells × 3 grids correct. Output 8,813
tokens, terminated `end_turn`. The single error from v1 is gone.

**Cost:** ~28K input (3-shot prefix dominates) + 8.8K output ≈ $1.10 / trial.

---

## 2026-05-11 — Prompt caching

**Change:** marked the final assistant message of the 3-shot prefix as an
ephemeral cache breakpoint. The prefix (system + 3 user/assistant pairs ≈ 28K
tokens) is identical across all trials; only the trailing ~50-token user prompt
varies.

**Smoke verification (toad, 2 sequential trials):**
- trial 0: cache_creation = 28,128, cache_read = 0 (cold)
- trial 1: cache_creation =    147, cache_read = 28,128 (warm)
- Both: 8,813 output tokens, identical raw text, 100% strict pass.

**Finding: Opus 4.7 sampling is deterministic for fixed input.** Bit-identical
output across the two trials. This means N>1 trials of the same pattern is
informationally wasted — to get variance we need to vary the input
(different soup seeds) or the prompt structure (shuffle few-shots, ablate).

---

## 2026-05-11 — Full N=1 sweep across 8 test patterns

**Patterns:** toad, beacon, glider-displaced, lwss, three random soups (seeds
0xc0ffee / 0xbadbeef / 0xfacade), r-pentomino.

**Result: 8/8 strict pass.** All natural completions, no truncation.

| pattern | size | steps | output tokens | cache |
|---|---|---|---|---|
| toad             | 6×6 | 2 |  8,813 | wrote 28K (cold) |
| beacon           | 6×6 | 2 |  8,803 | read |
| glider-displaced | 6×6 | 3 | 13,100 | read |
| lwss             | 7×7 | 2 | 11,923 | read |
| random-soup-a    | 6×6 | 3 | 12,980 | read |
| random-soup-b    | 6×6 | 3 | 13,022 | read |
| random-soup-c    | 6×6 | 3 | 12,991 | read |
| r-pentomino      | 7×7 | 2 | 11,957 | read |

**Total cost:** ~$7.50.

**Tier scoring against the spec:**
- Tier 1 (still/baseline): met (toad/beacon implicit)
- Tier 2 (oscillators, full period): met (toad)
- Tier 3 (spaceships, 3 steps): met (glider-displaced, lwss)
- Tier 4 (chaos, 3 steps): met (r-pentomino + 3 soups)

**Caveats:**
- N=1 + determinism means we haven't tested noise robustness. Sampling is
  fixed, so the "are trials independent samples" question is moot.
- 6×6 and 7×7 are small. Attention failure modes may show up only at larger
  grids.
- We haven't ablated the format. The success could be over-attributed to the
  source-coord marking when other features (cumulative tally, lookup header,
  three-shot count) might be doing the heavy lifting.

**Open questions for next runs:**
1. Does v2 hold at 10×10? Larger grids = more cells to attend to per step.
2. Does v2 hold at >3 steps?
3. Which tape ingredients are load-bearing? (Format ablations.)
4. Does the model break gracefully (small drift) or catastrophically when it
   does fail?

---

## 2026-05-11 — 10×10 grids: first false start, then streaming + 32K cap

**Added patterns:** lwss-10x10 (LWSS centered in a 10×10), three random soups
(two at 30% density different seeds, one at 40%). All 2 steps.

**First attempt (MAX_TOKENS=16384, non-streaming):** 0/4 strict pass.
First divergence at step 2 on all four. *Not a methodology failure* — all four
hit `stop_reason=max_tokens` mid-step-2. Each call was truncated around cell
r3c5 of step 2 (≈35/100 cells in). Step 1 was correct in all cases.

**Diagnosis:** 10×10 / 2-step in v2 format needs ~24K output tokens — the
v2 format's source-coord marking inflated per-cell line length, and 100 cells
× 2 steps blew through 16K.

**Fix:** switch from `messages.create()` to `messages.stream()` so the SDK
doesn't apply the 10-minute non-streaming timeout guard (which fires above
~21K max_tokens). Bumped `MAX_TOKENS` to 32000.

**Second attempt:** **4/4 strict pass.** All natural completions.

| pattern | size | steps | output tokens |
|---|---|---|---|
| lwss-10x10       | 10×10 | 2 | 24,298 |
| soup-10x10-30-a  | 10×10 | 2 | 24,115 |
| soup-10x10-30-b  | 10×10 | 2 | 24,071 |
| soup-10x10-40    | 10×10 | 2 | 23,232 |

Cache was still warm from the 8-pattern sweep (5-min TTL kept refreshing); 0
writes, 4 reads of 28,128 tokens each. Sweep cost ~$7.40 — output dominates
at 10×10.

**Updated finding: v2 holds at 10×10 / 2 steps.** That's 100 cells × 2 = 200
cell lines with correct neighbor lookups across a much larger INDEXED block.
The source-coord copy mechanism scales.

**Where this leaves the open questions:**
- (1) Grid size: still passing at 10×10. Not yet tested past that.
- (2) Step count: not yet pushed past 3.
- (3) Format ablations: still TODO. The most informative next experiment.
- (4) Failure modes: we still haven't *seen* v2 fail. Need bigger / longer
  / ablated to break it and study the failure shape.
