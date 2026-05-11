import { simulate, gridsEqual, type Grid } from "../src/groundTruth.ts";
import { glider6x6, lwss7x7, randomSoup6x6, rPentomino7x7 } from "../src/patterns.ts";
import { formatTape, parseGridsFromResponse } from "../src/tape.ts";

function test(name: string, grid: Grid, n: number): void {
  const truth = simulate(grid, n);
  const tape = formatTape(truth);
  const parsed = parseGridsFromResponse(tape, n);
  let allOk = parsed.length === truth.length;
  for (let i = 0; i < truth.length && allOk; i++) {
    if (!parsed[i] || !gridsEqual(parsed[i]!, truth[i]!)) allOk = false;
  }
  console.log(`${name}: ${allOk ? "OK" : "FAIL"} (${parsed.length}/${truth.length})`);
}

test("glider 4", glider6x6(), 4);
test("lwss 3", lwss7x7(), 3);
test("soup 5", randomSoup6x6(42), 5);
test("rpent 4", rPentomino7x7(), 4);
