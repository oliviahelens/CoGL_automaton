import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreTrial, summarizePattern, type PatternSummary } from "./eval.ts";
import { TEST_PATTERNS, TEST_PATTERNS_10X10, type NamedPattern } from "./patterns.ts";
import { MAX_TOKENS, MODEL, SYSTEM_PROMPT, runTrial } from "./run.ts";

type Suite = "small" | "10x10";

type Args = {
  nTrials: number;
  patterns: string[] | null;
  concurrency: number;
  outDir: string;
  suite: Suite;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {
    nTrials: 10,
    patterns: null,
    concurrency: 4,
    suite: "small",
    outDir: resolve(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "results",
      new Date().toISOString().replace(/[:.]/g, "-"),
    ),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--trials" || arg === "-n") a.nTrials = Number(argv[++i]);
    else if (arg === "--patterns") a.patterns = argv[++i]!.split(",");
    else if (arg === "--concurrency") a.concurrency = Number(argv[++i]);
    else if (arg === "--out") a.outDir = resolve(argv[++i]!);
    else if (arg === "--suite") {
      const v = argv[++i];
      if (v !== "small" && v !== "10x10") {
        console.error(`Unknown suite: ${v}`);
        process.exit(1);
      }
      a.suite = v;
    }
  }
  return a;
}

function suiteFor(suite: Suite): NamedPattern[] {
  return suite === "10x10" ? TEST_PATTERNS_10X10 : TEST_PATTERNS;
}

async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}

async function runPattern(
  pattern: NamedPattern,
  nTrials: number,
  concurrency: number,
  rawDir: string,
): Promise<PatternSummary> {
  const trialIdx = Array.from({ length: nTrials }, (_, i) => i);
  const scores = await runWithLimit(trialIdx, concurrency, async (idx) => {
    const result = await runTrial(pattern.name, pattern.grid, pattern.steps, idx);
    const rawPath = resolve(rawDir, `${pattern.name}-${idx}.txt`);
    await writeFile(rawPath, result.response, "utf8");
    const metaPath = resolve(rawDir, `${pattern.name}-${idx}.meta.json`);
    await writeFile(
      metaPath,
      JSON.stringify(
        { stopReason: result.stopReason, usage: result.usage },
        null,
        2,
      ),
    );
    const score = scoreTrial(result.parsedGrids, result.groundTruth);
    return score;
  });
  return summarizePattern(pattern.name, scores);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const available = suiteFor(args.suite);
  const chosen = args.patterns
    ? available.filter((p) => args.patterns!.includes(p.name))
    : available;
  if (chosen.length === 0) {
    console.error(
      `No matching patterns in suite "${args.suite}". Available:`,
      available.map((p) => p.name).join(", "),
    );
    process.exit(1);
  }

  const rawDir = resolve(args.outDir, "raw");
  await mkdir(rawDir, { recursive: true });

  const config = {
    model: MODEL,
    maxTokens: MAX_TOKENS,
    systemPrompt: SYSTEM_PROMPT,
    nTrials: args.nTrials,
    concurrency: args.concurrency,
    patterns: chosen.map((p) => ({ name: p.name, steps: p.steps })),
    startedAt: new Date().toISOString(),
  };
  await writeFile(
    resolve(args.outDir, "config.json"),
    JSON.stringify(config, null, 2),
  );

  const summaries: PatternSummary[] = [];
  for (const pattern of chosen) {
    console.log(`Running ${pattern.name} (${args.nTrials} trials)...`);
    const summary = await runPattern(
      pattern,
      args.nTrials,
      args.concurrency,
      rawDir,
    );
    summaries.push(summary);
    console.log(
      `  strict pass: ${(summary.strictPassRate * 100).toFixed(1)}% | first-div mean: ${summary.meanFirstDivergence?.toFixed(2) ?? "n/a"}`,
    );
  }

  await writeFile(
    resolve(args.outDir, "summary.json"),
    JSON.stringify({ config, summaries }, null, 2),
  );
  console.log(`\nResults written to ${args.outDir}`);
}

void main();
