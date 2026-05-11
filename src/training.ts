import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { simulate } from "./groundTruth.ts";
import { TRAINING_PATTERNS } from "./patterns.ts";
import { formatTape, formatUserPrompt } from "./tape.ts";

export type TrainingExample = {
  name: string;
  userPrompt: string;
  assistantTape: string;
};

export function buildTrainingExamples(): TrainingExample[] {
  return TRAINING_PATTERNS.map(({ name, grid, steps }) => {
    const trace = simulate(grid, steps);
    return {
      name,
      userPrompt: formatUserPrompt(grid, steps),
      assistantTape: formatTape(trace, { includePrint: true }),
    };
  });
}

async function writeTapes(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, "..", "tapes");
  await mkdir(outDir, { recursive: true });
  for (const ex of buildTrainingExamples()) {
    const body = `=== USER ===\n${ex.userPrompt}\n\n=== ASSISTANT ===\n${ex.assistantTape}\n`;
    const path = resolve(outDir, `${ex.name}.txt`);
    await writeFile(path, body, "utf8");
    console.log(`wrote ${path} (${body.length} chars)`);
  }
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("training.ts");
if (isMain) {
  void writeTapes();
}
