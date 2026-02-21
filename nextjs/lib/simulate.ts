/**
 * Monte Carlo simulation: run trials, return win/tie/lose counts.
 * Uses partial Fisher–Yates for drawing.
 */

import { buildDeck, drawCards, createSeededRng } from "./cards";
import { bestHandScore } from "./evaluate";

const PRESET_TRIALS: Record<string, number> = {
  fast: 50_000,
  standard: 200_000,
  high: 1_000_000,
};

export function getTrialsForPreset(preset: string): number {
  return PRESET_TRIALS[preset] ?? PRESET_TRIALS.standard;
}

export interface SimulateInput {
  players: number;
  hero: string[];
  board: string[];
  trials: number;
  seed?: number;
}

export interface SimulateResult {
  win: number;
  tie: number;
  lose: number;
  trials: number;
  elapsedMs: number;
}

/**
 * Run one trial: assign opponent hands and complete board, then compare hero vs all.
 * Lower score = better hand.
 */
function runOneTrial(
  hero: string[],
  board: string[],
  deck: string[],
  numOpponents: number,
  needBoard: number,
  rng: () => number,
  scratch: string[]
): "win" | "tie" | "lose" {
  const nDraw = numOpponents * 2 + needBoard;
  drawCards(deck, nDraw, rng, scratch);

  let offset = 0;
  const allBoard = board.length === 5 ? [...board] : [...board, ...scratch.slice(offset, (offset += needBoard))];
  const heroSeven = [...hero, ...allBoard];
  const heroScore = bestHandScore(heroSeven);

  let bestOpp = 999999;
  for (let i = 0; i < numOpponents; i++) {
    const oppHand = scratch.slice(offset, (offset += 2));
    const oppSeven = [...oppHand, ...allBoard];
    const score = bestHandScore(oppSeven);
    if (score < bestOpp) bestOpp = score;
  }

  if (heroScore < bestOpp) return "win";
  if (heroScore > bestOpp) return "lose";
  return "tie";
}

/**
 * Full simulation (main thread).
 */
export function simulate(input: SimulateInput): SimulateResult {
  const { players, hero, board, trials, seed } = input;
  const numOpponents = players - 1;
  if (numOpponents < 0) {
    return { win: 1, tie: 0, lose: 0, trials: 0, elapsedMs: 0 };
  }
  const needBoard = 5 - board.length;
  const rng = seed !== undefined ? createSeededRng(seed) : () => Math.random();
  const start = performance.now();
  const known = [...hero, ...board];
  const deckTemplate = buildDeck(known);
  const nDraw = numOpponents * 2 + needBoard;
  const scratch: string[] = new Array(nDraw);
  let win = 0,
    tie = 0,
    lose = 0;
  for (let i = 0; i < trials; i++) {
    const deck = [...deckTemplate];
    const result = runOneTrial(hero, board, deck, numOpponents, needBoard, rng, scratch);
    if (result === "win") win++;
    else if (result === "tie") tie++;
    else lose++;
  }
  const elapsedMs = performance.now() - start;
  return {
    win: win / trials,
    tie: tie / trials,
    lose: lose / trials,
    trials,
    elapsedMs,
  };
}
