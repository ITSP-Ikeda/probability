import { NextRequest, NextResponse } from "next/server";
import { getPreflopTableForPlayers, loadPreflopTable } from "@/lib/preflopTable";

/**
 * GET /api/preflop-table?players=6
 * 指定人数の169ハンド一覧を返す（固定表未生成の場合は 400）
 */
export async function GET(request: NextRequest) {
  const table = loadPreflopTable();
  if (table == null) {
    return NextResponse.json(
      { error: "preflop_table_not_generated", details: "preflop table not generated. Run: npm run gen:preflop" },
      { status: 400 }
    );
  }
  const playersParam = request.nextUrl.searchParams.get("players");
  const players = playersParam != null ? parseInt(playersParam, 10) : NaN;
  if (!Number.isInteger(players) || players < 2 || players > 10) {
    return NextResponse.json(
      { error: "invalid_players", details: "players must be an integer between 2 and 10" },
      { status: 400 }
    );
  }
  const data = getPreflopTableForPlayers(players);
  if (data == null) {
    return NextResponse.json(
      { error: "preflop_table_missing_players", details: `no data for players=${players}` },
      { status: 400 }
    );
  }
  return NextResponse.json({
    players,
    trialsPerHand: table.trialsPerHand,
    data,
  });
}
