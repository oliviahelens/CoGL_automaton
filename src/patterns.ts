import type { Cell, Grid } from "./groundTruth.ts";

function blank(R: number, C: number): Grid {
  return Array.from({ length: R }, () =>
    Array.from({ length: C }, () => 0 as Cell),
  );
}

function setLive(g: Grid, cells: Array<[number, number]>): Grid {
  for (const [r, c] of cells) g[r]![c] = 1;
  return g;
}

// Training patterns
export function block4x4(): Grid {
  // 2x2 block embedded in 4x4 — still life
  return setLive(blank(4, 4), [
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
  ]);
}

export function blinker5x5(): Grid {
  // horizontal blinker in 5x5
  return setLive(blank(5, 5), [
    [2, 1],
    [2, 2],
    [2, 3],
  ]);
}

export function glider6x6(): Grid {
  // canonical glider, top-left
  return setLive(blank(6, 6), [
    [0, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ]);
}

// Test patterns
export function toad6x6(): Grid {
  return setLive(blank(6, 6), [
    [2, 2],
    [2, 3],
    [2, 4],
    [3, 1],
    [3, 2],
    [3, 3],
  ]);
}

export function beacon6x6(): Grid {
  return setLive(blank(6, 6), [
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
    [3, 3],
    [3, 4],
    [4, 3],
    [4, 4],
  ]);
}

export function gliderDisplaced6x6(): Grid {
  // glider starting one row/col offset from the training one
  return setLive(blank(6, 6), [
    [1, 2],
    [2, 3],
    [3, 1],
    [3, 2],
    [3, 3],
  ]);
}

export function lwss7x7(): Grid {
  // lightweight spaceship
  return setLive(blank(7, 7), [
    [1, 1],
    [1, 4],
    [2, 5],
    [3, 1],
    [3, 5],
    [4, 2],
    [4, 3],
    [4, 4],
    [4, 5],
  ]);
}

export function randomSoup6x6(seed: number): Grid {
  // deterministic 30% density via mulberry32
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = blank(6, 6);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      g[r]![c] = rand() < 0.3 ? 1 : 0;
    }
  }
  return g;
}

export function rPentomino7x7(): Grid {
  return setLive(blank(7, 7), [
    [2, 3],
    [2, 4],
    [3, 2],
    [3, 3],
    [4, 3],
  ]);
}

export type NamedPattern = {
  name: string;
  grid: Grid;
  steps: number;
};

export const TRAINING_PATTERNS: NamedPattern[] = [
  { name: "block", grid: block4x4(), steps: 2 },
  { name: "blinker", grid: blinker5x5(), steps: 2 },
  { name: "glider", grid: glider6x6(), steps: 4 },
];

export const TEST_PATTERNS: NamedPattern[] = [
  { name: "toad", grid: toad6x6(), steps: 2 },
  { name: "beacon", grid: beacon6x6(), steps: 2 },
  { name: "glider-displaced", grid: gliderDisplaced6x6(), steps: 3 },
  { name: "lwss", grid: lwss7x7(), steps: 2 },
  { name: "random-soup-a", grid: randomSoup6x6(0xc0ffee), steps: 3 },
  { name: "random-soup-b", grid: randomSoup6x6(0xbadbeef), steps: 3 },
  { name: "random-soup-c", grid: randomSoup6x6(0xfacade), steps: 3 },
  { name: "r-pentomino", grid: rPentomino7x7(), steps: 2 },
];
