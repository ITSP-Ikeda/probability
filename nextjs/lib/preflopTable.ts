/**
 * プリフロップ固定表の読み込みと参照。
 * サーバーで1回読み込み、メモリに保持（Next では初回参照時に読み込み＆キャッシュ）。
 */

import * as fs from "fs";
import * as path from "path";

export interface PreflopRow {
  win: number;
  tie: number;
  lose: number;
}

export interface PreflopTableData {
  version: string;
  generatedAt: string;
  method: string;
  trialsPerHand: number;
  playersMin: number;
  playersMax: number;
  data: Record<string, Record<string, PreflopRow>>;
}

let cachedTable: PreflopTableData | null = null;
let loadAttempted = false;

/**
 * data/preflop_table.v1.json を読み込み、バリデーションしてキャッシュする。
 * 失敗時は null を返す（固定表未生成）。
 */
export function loadPreflopTable(): PreflopTableData | null {
  if (cachedTable !== null) return cachedTable;
  if (loadAttempted) return null;
  loadAttempted = true;
  try {
    const base = process.cwd();
    const filePath = path.join(base, "data", "preflop_table.v1.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    cachedTable = validateAndNormalize(parsed);
    return cachedTable;
  } catch {
    return null;
  }
}

function validateAndNormalize(obj: unknown): PreflopTableData | null {
  if (obj == null || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const version = typeof o.version === "string" ? o.version : "";
  const generatedAt = typeof o.generatedAt === "string" ? o.generatedAt : "";
  const method = typeof o.method === "string" ? o.method : "";
  const trialsPerHand = typeof o.trialsPerHand === "number" ? o.trialsPerHand : 0;
  const playersMin = typeof o.playersMin === "number" ? o.playersMin : 2;
  const playersMax = typeof o.playersMax === "number" ? o.playersMax : 10;
  const data = o.data;
  if (data == null || typeof data !== "object") return null;
  const dataMap: Record<string, Record<string, PreflopRow>> = {};
  for (const key of Object.keys(data)) {
    const p = Number(key);
    if (!Number.isInteger(p) || p < 2 || p > 10) continue;
    const inner = (data as Record<string, unknown>)[key];
    if (inner == null || typeof inner !== "object") continue;
    const innerMap: Record<string, PreflopRow> = {};
    for (const hc of Object.keys(inner as Record<string, unknown>)) {
      const row = (inner as Record<string, unknown>)[hc];
      if (row != null && typeof row === "object" && "win" in row && "tie" in row && "lose" in row) {
        const r = row as Record<string, number>;
        innerMap[hc] = {
          win: Number(r.win),
          tie: Number(r.tie),
          lose: Number(r.lose),
        };
      }
    }
    dataMap[key] = innerMap;
  }
  return {
    version,
    generatedAt,
    method,
    trialsPerHand,
    playersMin,
    playersMax,
    data: dataMap,
  };
}

/**
 * 固定表が読み込まれているか
 */
export function isPreflopTableLoaded(): boolean {
  return loadPreflopTable() !== null;
}

/**
 * (players, handClass) で win/tie/lose を返す。存在しなければ null。
 */
export function getPreflopEquity(players: number, handClass: string): PreflopRow | null {
  const table = loadPreflopTable();
  if (table == null) return null;
  const byPlayers = table.data[String(players)];
  if (byPlayers == null) return null;
  const row = byPlayers[handClass];
  return row ?? null;
}

/**
 * 指定人数の169ハンド一覧を返す（GET /api/preflop-table 用）
 */
export function getPreflopTableForPlayers(players: number): Record<string, PreflopRow> | null {
  const table = loadPreflopTable();
  if (table == null) return null;
  const byPlayers = table.data[String(players)];
  return byPlayers ?? null;
}

export function getTrialsPerHand(): number | null {
  const table = loadPreflopTable();
  return table?.trialsPerHand ?? null;
}
