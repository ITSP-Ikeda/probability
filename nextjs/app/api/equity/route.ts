import { NextRequest, NextResponse } from "next/server";
import { validateInput, parseCard } from "@/lib/cards";
import { toHandClass } from "@/lib/handClass";
import { getPreflopEquity, getTrialsPerHand, loadPreflopTable } from "@/lib/preflopTable";
import { simulate, getTrialsForPreset } from "@/lib/simulate";

const PRESETS = ["fast", "standard", "high"] as const;

function normalizeCard(c: string): string | null {
  const r = parseCard(c);
  return "card" in r ? (r.card ?? null) : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { players, hero: heroRaw, board: boardRaw, preset, seed } = body ?? {};

    if (typeof players !== "number" || players < 2 || players > 10) {
      return NextResponse.json(
        { error: "invalid_players", details: "players must be a number between 2 and 10" },
        { status: 400 }
      );
    }

    const heroArr = Array.isArray(heroRaw) ? heroRaw : [];
    const boardArr = Array.isArray(boardRaw) ? boardRaw : [];
    if (heroArr.length !== 2) {
      return NextResponse.json(
        { error: "invalid_hero", details: "hero must be exactly 2 cards" },
        { status: 400 }
      );
    }

    const hero: string[] = [];
    for (const c of heroArr) {
      const n = normalizeCard(String(c));
      if (n == null) {
        const r = parseCard(String(c));
        return NextResponse.json(
          { error: "error" in r ? r.error : "invalid_card", details: "details" in r ? r.details : undefined, card: String(c) },
          { status: 400 }
        );
      }
      hero.push(n);
    }
    const board: string[] = [];
    for (const c of boardArr) {
      const n = normalizeCard(String(c));
      if (n == null) {
        const r = parseCard(String(c));
        return NextResponse.json(
          { error: "error" in r ? r.error : "invalid_card", details: "details" in r ? r.details : undefined, card: String(c) },
          { status: 400 }
        );
      }
      board.push(n);
    }

    const validation = validateInput(hero, board);
    if (!("ok" in validation)) {
      return NextResponse.json(
        { error: validation.error, details: validation.details, card: validation.card },
        { status: 400 }
      );
    }

    const boardLen = board.length;

    // board_len === 0: プリフロップ固定表を参照（存在する場合）
    if (boardLen === 0) {
      const handClass = toHandClass(hero);
      if (handClass == null) {
        return NextResponse.json(
          { error: "invalid_hero", details: "could not derive hand class from hero cards" },
          { status: 400 }
        );
      }
      const table = loadPreflopTable();
      if (table == null) {
        return NextResponse.json(
          { error: "preflop_table_not_generated", details: "preflop table not generated. Run: npm run gen:preflop" },
          { status: 400 }
        );
      }
      const row = getPreflopEquity(players, handClass);
      if (row == null) {
        return NextResponse.json(
          { error: "preflop_table_missing_entry", details: `no entry for players=${players}, handClass=${handClass}` },
          { status: 400 }
        );
      }
      const trialsPerHand = getTrialsPerHand() ?? 0;
      const note =
        preset != null || (seed !== undefined && seed !== null)
          ? "preset and seed are ignored when using preflop table"
          : undefined;
      return NextResponse.json({
        win: row.win,
        tie: row.tie,
        lose: row.lose,
        trials: trialsPerHand,
        elapsedMs: 0,
        method: "preflop_table",
        ...(note ? { note } : {}),
      });
    }

    const pres = preset == null ? "standard" : String(preset).toLowerCase();
    if (!PRESETS.includes(pres as (typeof PRESETS)[number])) {
      return NextResponse.json(
        { error: "invalid_preset", details: `preset must be one of: ${PRESETS.join(", ")}` },
        { status: 400 }
      );
    }
    const trials = getTrialsForPreset(pres);
    const seedVal = seed !== undefined && seed !== null ? Number(seed) : undefined;
    if (seedVal !== undefined && !Number.isInteger(seedVal)) {
      return NextResponse.json({ error: "invalid_seed", details: "seed must be an integer" }, { status: 400 });
    }

    const result = simulate({ players, hero, board, trials, seed: seedVal });

    return NextResponse.json({
      win: Math.round(result.win * 1e6) / 1e6,
      tie: Math.round(result.tie * 1e6) / 1e6,
      lose: Math.round(result.lose * 1e6) / 1e6,
      trials: result.trials,
      elapsedMs: Math.round(result.elapsedMs),
      method: "monte_carlo",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "internal_error", details: String(e) },
      { status: 500 }
    );
  }
}
