import Anthropic from "@anthropic-ai/sdk";
import { simulate, type Grid } from "./groundTruth.ts";
import { buildTrainingExamples } from "./training.ts";
import { formatUserPrompt, parseGridsFromResponse } from "./tape.ts";

export const MODEL = "claude-opus-4-7";
export const MAX_TOKENS = 16384;
// Note: temperature is deprecated on Opus 4.7 — model uses fixed sampling.

export const SYSTEM_PROMPT =
  "You are simulating Conway's Game of Life (rule B3/S23, boundary=dead). " +
  "Follow the exact tape format shown in the examples: emit the LOOKUP header, then for each step emit GRID t/N, INDEXED, STEP t→t+1 with one line per cell enumerating all 8 neighbors with cumulative live tally, and NEW GRID t+1/N. " +
  "For each neighbor, write its source coordinate and value (e.g. NW=r2c2█) copied from the INDEXED block. Out-of-bounds neighbors are written as `oob░`. " +
  "Compute every cell explicitly. Do not skip cells. Do not summarize.";

export type TrialResult = {
  pattern: string;
  trial: number;
  response: string;
  parsedGrids: Grid[];
  groundTruth: Grid[];
  stopReason: string | null;
  usage: { input_tokens: number; output_tokens: number } | null;
};

let cachedClient: Anthropic | null = null;
function client(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

let cachedShots: ReturnType<typeof buildTrainingExamples> | null = null;
function fewShot() {
  if (!cachedShots) cachedShots = buildTrainingExamples();
  return cachedShots;
}

export async function runTrial(
  pattern: string,
  initial: Grid,
  nSteps: number,
  trialIdx: number,
): Promise<TrialResult> {
  const shots = fewShot();
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const ex of shots) {
    messages.push({ role: "user", content: ex.userPrompt });
    messages.push({ role: "assistant", content: ex.assistantTape });
  }
  const userPrompt = formatUserPrompt(initial, nSteps);
  messages.push({ role: "user", content: userPrompt });

  let response;
  try {
    response = await client().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
    });
  } catch (e: unknown) {
    if (e instanceof Anthropic.APIError) {
      console.error(`API error (status=${e.status}):`, JSON.stringify(e.error, null, 2));
    }
    throw e;
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsedGrids = parseGridsFromResponse(text, nSteps);
  const groundTruth = simulate(initial, nSteps);

  return {
    pattern,
    trial: trialIdx,
    response: text,
    parsedGrids,
    groundTruth,
    stopReason: response.stop_reason,
    usage: response.usage
      ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        }
      : null,
  };
}
