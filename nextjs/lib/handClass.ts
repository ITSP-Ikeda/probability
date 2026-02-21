/**
 * Hero 2枚から 169 ハンドクラス（AA, AKs, AKo 等）を導出する。
 * ランクは A,K,Q,J,T,9..2 の降順で正規化。
 */

import { RANKS, SUITS } from "./cards";

export const RANK_ORDER = RANKS; // A=0, K=1, ... 2=12 の並び

/**
 * カード文字列 "As" からランクインデックス（0=A, 12=2）とスートインデックスを取得
 */
export function rankAndSuit(card: string): { rankIdx: number; suitIdx: number } | null {
  if (card.length !== 2) return null;
  const rankCh = card[0].toUpperCase();
  const suitCh = card[1].toLowerCase();
  const rankIdx = RANKS.indexOf(rankCh);
  const suitIdx = SUITS.indexOf(suitCh);
  if (rankIdx < 0 || suitIdx < 0) return null;
  return { rankIdx, suitIdx };
}

/**
 * Hero 2枚（正規化済みカード文字列）から hand_class を返す。
 * ペア → "AA", "77" 等（s/o なし）
 * ペア以外: スート同じ → "AKs", 違う → "AKo"
 * ランクは必ず降順（高→低）で正規化する。
 */
export function toHandClass(heroCards: string[]): string | null {
  if (heroCards.length !== 2) return null;
  const a = rankAndSuit(heroCards[0]);
  const b = rankAndSuit(heroCards[1]);
  if (a == null || b == null) return null;
  let r1: number, r2: number;
  if (a.rankIdx <= b.rankIdx) {
    r1 = a.rankIdx;
    r2 = b.rankIdx;
  } else {
    r1 = b.rankIdx;
    r2 = a.rankIdx;
  }
  const c1 = RANKS[r1];
  const c2 = RANKS[r2];
  if (r1 === r2) {
    return c1 + c2;
  }
  const suited = a.suitIdx === b.suitIdx;
  return c1 + c2 + (suited ? "s" : "o");
}

/**
 * 169 ハンドクラスをすべて列挙（ペア・ suited ・ offsuit の順で一意）
 */
export function allHandClasses(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 13; i++) {
    out.push(RANKS[i] + RANKS[i]);
  }
  for (let i = 0; i < 13; i++) {
    for (let j = i + 1; j < 13; j++) {
      out.push(RANKS[i] + RANKS[j] + "s");
      out.push(RANKS[i] + RANKS[j] + "o");
    }
  }
  return out;
}

/**
 * hand_class を代表2枚のカードに変換（固定マッピング）
 * 例: AA -> [As, Ad], AKs -> [As, Ks], AKo -> [As, Kd]
 */
export function handClassToCards(handClass: string): string[] | null {
  const h = handClass.trim();
  if (h.length === 2) {
    const r = RANKS.indexOf(h[0]);
    if (r < 0 || h[0] !== h[1]) return null;
    return [RANKS[r] + "s", RANKS[r] + "h"];
  }
  if (h.length === 3) {
    const r1 = RANKS.indexOf(h[0]);
    const r2 = RANKS.indexOf(h[1]);
    if (r1 < 0 || r2 < 0 || r1 <= r2) return null;
    const last = h[2].toLowerCase();
    if (last === "s") return [RANKS[r1] + "s", RANKS[r2] + "s"];
    if (last === "o") return [RANKS[r1] + "s", RANKS[r2] + "d"];
  }
  return null;
}
