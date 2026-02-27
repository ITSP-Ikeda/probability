/**
 * プリフロップ固定表を生成する CLI。
 * 169 ハンドクラス × players 2..10 でモンテカルロを実行し、data/preflop_table.v1.json に出力する。
 * 起動時には実行しない。手動で docker compose run --rm app npm run gen:preflop 等で実行。
 */

import * as fs from "fs";
import * as path from "path";
import { buildDeck } from "../lib/cards";
import { bestHandScore } from "../lib/evaluate";
import { allHandClasses, handClassToCards } from "../lib/handClass";
import { simulate } from "../lib/simulate";

const DEFAULT_TRIALS = 2_000_000;

type GenMode = "monte_carlo" | "exact";

function parseArgs(): { out: string; trials: number; mode: GenMode; playersMin: number; playersMax: number } {
  const args = process.argv.slice(2);
  let out = path.join(process.cwd(), "data", "preflop_table.v1.json");
  let trials = DEFAULT_TRIALS;
  let mode: GenMode = "monte_carlo";
  let playersMin = 2;
  let playersMax = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) {
      out = args[i + 1];
      i++;
    } else if (args[i] === "--trials" && args[i + 1]) {
      trials = parseInt(args[i + 1], 10) || DEFAULT_TRIALS;
      i++;
    } else if (args[i] === "--mode" && args[i + 1]) {
      const m = String(args[i + 1]).toLowerCase();
      if (m === "monte_carlo" || m === "exact") mode = m;
      i++;
    } else if (args[i] === "--players-min" && args[i + 1]) {
      playersMin = parseInt(args[i + 1], 10) || 2;
      i++;
    } else if (args[i] === "--players-max" && args[i + 1]) {
      playersMax = parseInt(args[i + 1], 10) || 10;
      i++;
    }
  }
  return { out, trials, mode, playersMin, playersMax };
}

function exactHeadsUpPreflop(hero: string[]): { win: number; tie: number; lose: number; trials: number } {
  if (hero.length !== 2) throw new Error("exact mode requires hero=2 cards");
  const deck50 = buildDeck(hero);
  let win = 0;
  let tie = 0;
  let lose = 0;
  let total = 0;
  for (let i = 0; i < deck50.length - 1; i++) {
    for (let j = i + 1; j < deck50.length; j++) {
      const opp = [deck50[i], deck50[j]];
      const rem = buildDeck([...hero, ...opp]);
      for (let a = 0; a < rem.length - 4; a++) {
        for (let b = a + 1; b < rem.length - 3; b++) {
          for (let c = b + 1; c < rem.length - 2; c++) {
            for (let d = c + 1; d < rem.length - 1; d++) {
              for (let e = d + 1; e < rem.length; e++) {
                const board = [rem[a], rem[b], rem[c], rem[d], rem[e]];
                const heroScore = bestHandScore([...hero, ...board]);
                const oppScore = bestHandScore([...opp, ...board]);
                if (heroScore < oppScore) win++;
                else if (heroScore > oppScore) lose++;
                else tie++;
                total++;
              }
            }
          }
        }
      }
    }
  }
  return { win: win / total, tie: tie / total, lose: lose / total, trials: total };
}

function main() {
  const { out: outPath, trials, mode, playersMin, playersMax } = parseArgs();
  const handClasses = allHandClasses();
  if (playersMin < 2 || playersMax > 10 || playersMin > playersMax) {
    throw new Error(`invalid players range: ${playersMin}..${playersMax} (allowed 2..10)`);
  }
  if (mode === "exact" && (playersMin !== 2 || playersMax !== 2)) {
    throw new Error("exact mode currently supports only players=2; use --players-min 2 --players-max 2");
  }

  const data: Record<string, Record<string, { win: number; tie: number; lose: number }>> = {};
  for (let p = playersMin; p <= playersMax; p++) {
    data[String(p)] = {};
  }

  let done = 0;
  const total = handClasses.length * (playersMax - playersMin + 1);
  const startAll = Date.now();
  let metricPerHand = trials;

  for (const handClass of handClasses) {
    const cards = handClassToCards(handClass);
    if (!cards || cards.length !== 2) {
      console.error("Skip invalid hand class:", handClass);
      continue;
    }
    const board: string[] = [];
    for (let players = playersMin; players <= playersMax; players++) {
      const result =
        mode === "exact"
          ? exactHeadsUpPreflop(cards)
          : simulate({
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
      metricPerHand = result.trials;
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
    method: mode,
    trialsPerHand: metricPerHand,
    playersMin,
    playersMax,
    data,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  const elapsed = ((Date.now() - startAll) / 1000).toFixed(1);
  console.error(`Done. Wrote ${outPath} (${elapsed}s)`);
}

main();
