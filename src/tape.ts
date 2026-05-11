import { cols, rows, step, type Grid } from "./groundTruth.ts";

export const DEAD = "░";
export const LIVE = "█";

export function sym(v: 0 | 1): string {
  return v === 1 ? LIVE : DEAD;
}

const NEIGHBOR_OFFSETS: Array<{ name: string; dr: number; dc: number }> = [
  { name: "NW", dr: -1, dc: -1 },
  { name: "N", dr: -1, dc: 0 },
  { name: "NE", dr: -1, dc: 1 },
  { name: "W", dr: 0, dc: -1 },
  { name: "E", dr: 0, dc: 1 },
  { name: "SW", dr: 1, dc: -1 },
  { name: "S", dr: 1, dc: 0 },
  { name: "SE", dr: 1, dc: 1 },
];

export function formatHeader(): string {
  return [
    "RULE B3/S23",
    "LOOKUP",
    `  live+0→${DEAD}  live+1→${DEAD}  live+2→${LIVE}  live+3→${LIVE}`,
    `  live+4→${DEAD}  live+5→${DEAD}  live+6→${DEAD}  live+7→${DEAD}  live+8→${DEAD}`,
    `  dead+0→${DEAD}  dead+1→${DEAD}  dead+2→${DEAD}  dead+3→${LIVE}`,
    `  dead+4→${DEAD}  dead+5→${DEAD}  dead+6→${DEAD}  dead+7→${DEAD}  dead+8→${DEAD}`,
    "BOUNDARY dead",
  ].join("\n");
}

export function formatVisualGrid(g: Grid, label: string): string {
  const lines = [label];
  for (let r = 0; r < rows(g); r++) {
    const row = g[r]!.map((v) => sym(v)).join(" ");
    lines.push(`r${r}: ${row}`);
  }
  return lines.join("\n");
}

export function formatIndexedGrid(g: Grid): string {
  const lines = ["INDEXED"];
  for (let r = 0; r < rows(g); r++) {
    const row = g[r]!
      .map((v, c) => `r${r}c${c}${sym(v)}`)
      .join(" ");
    lines.push(row);
  }
  return lines.join("\n");
}

export function formatStep(g: Grid, t: number): string {
  const R = rows(g);
  const C = cols(g);
  const next = step(g);
  const lines: string[] = [`STEP ${t}→${t + 1}`];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const center = g[r]![c]!;
      const centerSym = sym(center);
      const cellLabel = `r${r}c${c}${centerSym}`;
      let tally = 0;
      const parts: string[] = [];
      for (const off of NEIGHBOR_OFFSETS) {
        const rr = r + off.dr;
        const cc = c + off.dc;
        let v: 0 | 1 = 0;
        if (rr >= 0 && rr < R && cc >= 0 && cc < C) {
          v = g[rr]![cc]!;
        }
        if (v === 1) tally++;
        parts.push(`${off.name}${sym(v)}(${tally})`);
      }
      const state = center === 1 ? "live" : "dead";
      const newV = next[r]![c]!;
      const newSym = sym(newV);
      lines.push(
        `${cellLabel}: ${parts.join(" ")} =${tally} ${state}+${tally}→${newSym} r${r}c${c}${newSym}`,
      );
    }
  }
  return lines.join("\n");
}

export function formatTape(grids: Grid[], opts?: { includePrint?: boolean }): string {
  const N = grids.length - 1;
  const blocks: string[] = [formatHeader()];
  for (let t = 0; t < N; t++) {
    const g = grids[t]!;
    blocks.push(formatVisualGrid(g, `GRID ${t}/${N}`));
    blocks.push(formatIndexedGrid(g));
    blocks.push(formatStep(g, t));
    blocks.push(formatVisualGrid(grids[t + 1]!, `NEW GRID ${t + 1}/${N}`));
  }
  blocks.push("DONE");
  if (opts?.includePrint ?? true) {
    for (let t = 0; t <= N; t++) {
      const flat = grids[t]!.flat().map((v) => sym(v)).join(" ");
      blocks.push(`PRINT ${t}/${N} ${flat}`);
    }
  }
  return blocks.join("\n");
}

export function formatUserPrompt(initial: Grid, steps: number): string {
  const R = rows(initial);
  const C = cols(initial);
  const lines = [`SIZE ${R}x${C}`, `STEPS ${steps}`];
  lines.push(formatVisualGrid(initial, `GRID 0/${steps}`));
  return lines.join("\n");
}

// Parsing — extract NEW GRID t/N blocks (and the initial GRID 0/N) from a response.
export function parseGridsFromResponse(text: string, expectedSteps: number): Grid[] {
  const result: Grid[] = [];
  for (let t = 0; t <= expectedSteps; t++) {
    const label = t === 0 ? `GRID 0/${expectedSteps}` : `NEW GRID ${t}/${expectedSteps}`;
    const grid = extractGridAfterLabel(text, label);
    if (!grid) break;
    result.push(grid);
  }
  return result;
}

function extractGridAfterLabel(text: string, label: string): Grid | null {
  const idx = text.indexOf(label);
  if (idx < 0) return null;
  // Read subsequent lines starting with `r<digits>:`
  const after = text.slice(idx + label.length);
  const lines = after.split("\n");
  const rowsOut: (0 | 1)[][] = [];
  const rowRe = /^\s*r(\d+):\s*(.+)$/;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      if (rowsOut.length === 0) continue;
      else break;
    }
    const m = rowRe.exec(line);
    if (!m) {
      if (rowsOut.length === 0) continue;
      else break;
    }
    const rowIdx = parseInt(m[1]!, 10);
    if (rowIdx !== rowsOut.length) break;
    const cells = m[2]!
      .trim()
      .split(/\s+/)
      .map((tok) => parseSym(tok))
      .filter((v): v is 0 | 1 => v !== null);
    rowsOut.push(cells);
  }
  if (rowsOut.length === 0) return null;
  const C = rowsOut[0]!.length;
  if (!rowsOut.every((r) => r.length === C)) return null;
  return rowsOut as Grid;
}

function parseSym(tok: string): 0 | 1 | null {
  if (tok === LIVE) return 1;
  if (tok === DEAD) return 0;
  return null;
}
