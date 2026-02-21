/**
 * Card parsing, validation, deck building, and partial Fisher–Yates draw.
 * Card format: "As", "Td", "7h" (Rank: A,K,Q,J,T,9..2 / Suit: s,h,d,c)
 */

export const RANKS = "AKQJT98765432";
export const SUITS = "shdc";

export const SUIT_SYMBOLS: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

export interface ParseError {
  error: string;
  card?: string;
  details?: string;
}

/**
 * Parse a single card string to normalized form (e.g. "As", "Td").
 * Returns error message or null if valid.
 */
export function parseCard(s: string): { card: string } | ParseError {
  const t = s.trim().replace(/^10/, "T");
  if (t.length !== 2) {
    return { error: "invalid_card_length", card: s, details: `Card must be 2 characters (e.g. As, Td), got: ${s}` };
  }
  const rank = t[0].toUpperCase();
  const suit = t[1].toLowerCase();
  if (!RANKS.includes(rank)) {
    return { error: "invalid_rank", card: s, details: `Rank must be one of ${RANKS}, got: ${rank}` };
  }
  if (!SUITS.includes(suit)) {
    return { error: "invalid_suit", card: s, details: `Suit must be one of s,h,d,c, got: ${suit}` };
  }
  const card = rank + suit;
  return { card };
}

/**
 * Parse space-separated card string into array of normalized cards.
 * Returns { cards } or { error, details }.
 */
export function parseCards(input: string): { cards: string[] } | ParseError {
  if (!input || typeof input !== "string") {
    return { error: "invalid_input", details: "Card input is required" };
  }
  const parts = input.trim().split(/\s+/).filter(Boolean);
  const cards: string[] = [];
  for (const p of parts) {
    const r = parseCard(p);
    if ("error" in r) return r;
    cards.push(r.card);
  }
  return { cards };
}

export type CardObj = { rank: string; suit: string };

function cardStringToObj(card: string): CardObj {
  return { rank: card[0], suit: card[1] };
}

/**
 * Return the first card (in RANKS×SUITS order) not in the used set.
 */
export function getNextAvailableCard(used: Set<string>): string {
  for (const r of RANKS) {
    for (const s of SUITS) {
      const card = r + s;
      if (!used.has(card)) return card;
    }
  }
  throw new Error("no available card");
}

/**
 * Resolve duplicates: process hero then board (first boardCount slots) in order,
 * replacing any duplicate with the next available card. Returns new arrays.
 */
export function resolveDuplicates(
  heroCards: CardObj[],
  boardCards: CardObj[],
  boardCount: number
): { heroCards: CardObj[]; boardCards: CardObj[] } {
  const used = new Set<string>();
  const resultHero: CardObj[] = [];

  for (let i = 0; i < heroCards.length; i++) {
    let card = heroCards[i].rank + heroCards[i].suit;
    if (used.has(card)) card = getNextAvailableCard(used);
    used.add(card);
    resultHero.push(cardStringToObj(card));
  }

  const resultBoard = boardCards.map((c) => ({ ...c }));
  for (let i = 0; i < boardCount && i < boardCards.length; i++) {
    let card = boardCards[i].rank + boardCards[i].suit;
    if (used.has(card)) card = getNextAvailableCard(used);
    used.add(card);
    resultBoard[i] = cardStringToObj(card);
  }

  return { heroCards: resultHero, boardCards: resultBoard };
}

/**
 * Check for duplicate cards across hero and board.
 */
export function findDuplicates(hero: string[], board: string[]): string[] {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const c of [...hero, ...board]) {
    if (seen.has(c)) dups.push(c);
    else seen.add(c);
  }
  return Array.from(new Set(dups));
}

/**
 * Validate: hero 2 cards, board 0/3/4/5, no duplicates.
 */
export function validateInput(hero: string[], board: string[]): { ok: true } | ParseError {
  if (!Array.isArray(hero) || hero.length !== 2) {
    return { error: "invalid_hero", details: "hero must be exactly 2 cards" };
  }
  if (!Array.isArray(board)) {
    return { error: "invalid_board", details: "board must be an array" };
  }
  const allowed = [0, 3, 4, 5];
  if (!allowed.includes(board.length)) {
    return { error: "invalid_board_length", details: `board must have 0, 3, 4, or 5 cards, got ${board.length}` };
  }
  const dups = findDuplicates(hero, board);
  if (dups.length > 0) {
    return { error: "duplicate_cards", details: `Duplicate cards: ${dups.join(", ")}`, card: dups[0] };
  }
  for (const c of [...hero, ...board]) {
    const r = parseCard(c);
    if ("error" in r) return r;
  }
  return { ok: true };
}

/**
 * Build deck as array of 52 card strings, excluding known cards.
 */
export function buildDeck(known: string[]): string[] {
  const set = new Set(known.map((c) => parseCard(c).card));
  const deck: string[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      const card = r + s;
      if (!set.has(card)) deck.push(card);
    }
  }
  return deck;
}

/**
 * Partial Fisher–Yates: from deck (mutated), draw `n` cards into `out` at offset 0.
 * deck length must be >= n. Returns the n drawn cards (same as out.slice(0, n)).
 */
export function drawCards(deck: string[], n: number, rng: () => number, out: string[]): void {
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (deck.length - i));
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
    out[i] = deck[i];
  }
}

/**
 * Seeded RNG (simple LCG) for reproducibility.
 */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
