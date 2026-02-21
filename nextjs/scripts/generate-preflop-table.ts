/**
 * プリフロップ固定表を生成する CLI。
 * 169 ハンドクラス × players 2..10 でモンテカルロを実行し、data/preflop_table.v1.json に出力する。
 * 起動時には実行しない。手動で docker compose run --rm app npm run gen:preflop 等で実行。
 */

import * as fs from "fs";
import * as path from "path";
import { allHandClasses, handClassToCards } from "../lib/handClass";
import { simulate } from "../lib/simulate";

const DEFAULT_TRIALS = 2_000_000;

function parseArgs(): { out: string; trials: number } {
  const args = process.argv.slice(2);
  let out = path.join(process.cwd(), "data", "preflop_table.v1.json");
  let trials = DEFAULT_TRIALS;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) {
      out = args[i + 1];
      i++;
    } else if (args[i] === "--trials" && args[i + 1]) {
      trials = parseInt(args[i + 1], 10) || DEFAULT_TRIALS;
      i++;
    }
  }
  return { out, trials };
}

function main() {
  const { out: outPath, trials } = parseArgs();
  const handClasses = allHandClasses();
  const playersMin = 2;
  const playersMax = 10;

  const data: Record<string, Record<string, { win: number; tie: number; lose: number }>> = {};
  for (let p = playersMin; p <= playersMax; p++) {
    data[String(p)] = {};
  }

  let done = 0;
  const total = handClasses.length * (playersMax - playersMin + 1);
  const startAll = Date.now();

  for (const handClass of handClasses) {
    const cards = handClassToCards(handClass);
    if (!cards || cards.length !== 2) {
      console.error("Skip invalid hand class:", handClass);
      continue;
    }
    const board: string[] = [];
    for (let players = playersMin; players <= playersMax; players++) {
      const result = simulate({
        players,
        hero: cards,
        board,
        trials,
        seed: undefined,
      });
      data[String(players)][handClass] = {
        win: Math.round(result.win * 1e6) / 1e6,
        tie: Math.round(result.tie * 1e6) / 1e6,
        lose: Math.round(result.lose * 1e6) / 1e6,
      };
      done++;
      if (done % 100 === 0) {
        console.error(`Progress: ${done}/${total} (${handClass} @ ${players}p)`);
      }
    }
  }

  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const payload = {
    version: "v1",
    generatedAt: new Date().toISOString(),
    method: "monte_carlo",
    trialsPerHand: trials,
    playersMin,
    playersMax,
    data,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  const elapsed = ((Date.now() - startAll) / 1000).toFixed(1);
  console.error(`Done. Wrote ${outPath} (${elapsed}s)`);
}

main();
