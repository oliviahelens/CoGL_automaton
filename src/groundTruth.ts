export type Cell = 0 | 1;
export type Grid = Cell[][];

export function rows(g: Grid): number {
  return g.length;
}

export function cols(g: Grid): number {
  return g[0]?.length ?? 0;
}

export function clone(g: Grid): Grid {
  return g.map((row) => [...row]);
}

export function liveNeighbors(g: Grid, r: number, c: number): number {
  const R = rows(g);
  const C = cols(g);
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= R || cc < 0 || cc >= C) continue;
      n += g[rr]![cc]!;
    }
  }
  return n;
}

export function step(g: Grid): Grid {
  const R = rows(g);
  const C = cols(g);
  const next: Grid = Array.from({ length: R }, () =>
    Array.from({ length: C }, () => 0 as Cell),
  );
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const live = g[r]![c]! === 1;
      const n = liveNeighbors(g, r, c);
      let nv: Cell = 0;
      if (live) nv = n === 2 || n === 3 ? 1 : 0;
      else nv = n === 3 ? 1 : 0;
      next[r]![c] = nv;
    }
  }
  return next;
}

export function simulate(g: Grid, n: number): Grid[] {
  const out: Grid[] = [clone(g)];
  let cur = g;
  for (let i = 0; i < n; i++) {
    cur = step(cur);
    out.push(cur);
  }
  return out;
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  if (rows(a) !== rows(b) || cols(a) !== cols(b)) return false;
  for (let r = 0; r < rows(a); r++) {
    for (let c = 0; c < cols(a); c++) {
      if (a[r]![c] !== b[r]![c]) return false;
    }
  }
  return true;
}

export function cellAccuracy(a: Grid, b: Grid): number {
  if (rows(a) !== rows(b) || cols(a) !== cols(b)) return 0;
  let match = 0;
  let total = 0;
  for (let r = 0; r < rows(a); r++) {
    for (let c = 0; c < cols(a); c++) {
      total++;
      if (a[r]![c] === b[r]![c]) match++;
    }
  }
  return total === 0 ? 1 : match / total;
}
