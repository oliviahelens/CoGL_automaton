import { cellAccuracy, gridsEqual, type Grid } from "./groundTruth.ts";

export type TrialScore = {
  parsedSteps: number;
  expectedSteps: number;
  firstDivergenceStep: number | null;
  cellAccuracyByStep: number[];
  perStepStrict: boolean[];
  strictPass: boolean;
};

export function scoreTrial(parsed: Grid[], truth: Grid[]): TrialScore {
  const expected = truth.length;
  const parsedSteps = parsed.length;
  const accuracies: number[] = [];
  const strict: boolean[] = [];
  let firstDiv: number | null = null;
  for (let t = 0; t < expected; t++) {
    const p = parsed[t];
    const g = truth[t]!;
    if (!p) {
      accuracies.push(0);
      strict.push(false);
      if (firstDiv === null) firstDiv = t;
      continue;
    }
    const acc = cellAccuracy(p, g);
    const eq = gridsEqual(p, g);
    accuracies.push(acc);
    strict.push(eq);
    if (!eq && firstDiv === null) firstDiv = t;
  }
  return {
    parsedSteps,
    expectedSteps: expected,
    firstDivergenceStep: firstDiv,
    cellAccuracyByStep: accuracies,
    perStepStrict: strict,
    strictPass: strict.every(Boolean),
  };
}

export type PatternSummary = {
  pattern: string;
  nTrials: number;
  strictPassRate: number;
  meanFirstDivergence: number | null;
  medianFirstDivergence: number | null;
  minFirstDivergence: number | null;
  cellAccuracyByStep: number[];
  perStepStrictPassRate: number[];
};

export function summarizePattern(
  pattern: string,
  scores: TrialScore[],
): PatternSummary {
  const n = scores.length;
  const strictPasses = scores.filter((s) => s.strictPass).length;
  const divergences = scores
    .map((s) => s.firstDivergenceStep)
    .filter((v): v is number => v !== null);

  const expected = scores[0]?.expectedSteps ?? 0;
  const cellAcc: number[] = Array.from({ length: expected }, () => 0);
  const stepStrict: number[] = Array.from({ length: expected }, () => 0);
  for (const s of scores) {
    for (let t = 0; t < expected; t++) {
      cellAcc[t]! += s.cellAccuracyByStep[t] ?? 0;
      stepStrict[t]! += s.perStepStrict[t] ? 1 : 0;
    }
  }
  for (let t = 0; t < expected; t++) {
    cellAcc[t]! /= n || 1;
    stepStrict[t]! /= n || 1;
  }

  return {
    pattern,
    nTrials: n,
    strictPassRate: n === 0 ? 0 : strictPasses / n,
    meanFirstDivergence:
      divergences.length === 0
        ? null
        : divergences.reduce((a, b) => a + b, 0) / divergences.length,
    medianFirstDivergence:
      divergences.length === 0 ? null : median(divergences),
    minFirstDivergence:
      divergences.length === 0 ? null : Math.min(...divergences),
    cellAccuracyByStep: cellAcc,
    perStepStrictPassRate: stepStrict,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}
