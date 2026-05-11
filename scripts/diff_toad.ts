import { simulate } from "../src/groundTruth.ts";
import { toad6x6 } from "../src/patterns.ts";
import { parseGridsFromResponse, sym } from "../src/tape.ts";
import { readFileSync } from "node:fs";

const raw = readFileSync(process.argv[2]!, "utf8");
const parsed = parseGridsFromResponse(raw, 2);
const truth = simulate(toad6x6(), 2);
for (let t = 0; t < truth.length; t++) {
  console.log(`\n=== Step ${t} ===`);
  console.log("Truth:");
  for (const row of truth[t]!) console.log("  " + row.map((v: 0|1) => sym(v)).join(" "));
  console.log("Model:");
  const p = parsed[t];
  if (!p) { console.log("  (missing)"); continue; }
  for (const row of p) console.log("  " + row.map((v: 0|1) => sym(v)).join(" "));
  console.log("Diffs (row,col,truth,model):");
  for (let r = 0; r < truth[t]!.length; r++) {
    for (let c = 0; c < truth[t]![0]!.length; c++) {
      if (p[r]?.[c] !== truth[t]![r]![c]) {
        console.log(`  r${r}c${c}: truth=${sym(truth[t]![r]![c]!)} model=${p[r]?.[c] === undefined ? "?" : sym(p[r]![c]!)}`);
      }
    }
  }
}
