/**
 * 7-card hand evaluation using @pokertools/evaluator.
 * Lower score = stronger hand. Compare scores to determine win/tie/lose.
 */

import { evaluate, getCardCode } from "@pokertools/evaluator";

/**
 * Convert card string "As" to evaluator format (same format; 10 is "T").
 */
function cardToCode(card: string): number {
  return getCardCode(card);
}

/**
 * Evaluate 7 cards and return comparable score (lower is better).
 */
export function evaluateHand(cards: string[]): number {
  if (cards.length !== 7) throw new Error("evaluateHand requires 7 cards");
  const codes = cards.map(cardToCode);
  return evaluate(codes);
}

/**
 * Get best hand score from 7 cards (evaluator already returns best 5-card score).
 */
export function bestHandScore(cards: string[]): number {
  return evaluateHand(cards);
}
