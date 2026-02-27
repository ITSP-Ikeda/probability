// プリフロップ固定表を生成する CLI。起動時には実行しない。

use std::collections::HashMap;
use std::path::PathBuf;
use texas_equity_api::{cards::Card, evaluate, hand_class, simulate};

const DEFAULT_TRIALS: u64 = 2_000_000;

struct Args {
    out: PathBuf,
    trials: u64,
    mode: String,
    players_min: u32,
    players_max: u32,
}

fn parse_args() -> Args {
    let args: Vec<String> = std::env::args().collect();
    let mut out = PathBuf::from("assets/data/preflop_table.v1.json");
    let mut trials = DEFAULT_TRIALS;
    let mut mode = String::from("monte_carlo");
    let mut players_min = 2u32;
    let mut players_max = 10u32;
    let mut i = 1;
    while i < args.len() {
        if args[i] == "--out" && i + 1 < args.len() {
            out = PathBuf::from(&args[i + 1]);
            i += 2;
            continue;
        }
        if args[i] == "--trials" && i + 1 < args.len() {
            trials = args[i + 1].parse().unwrap_or(DEFAULT_TRIALS);
            i += 2;
            continue;
        }
        if args[i] == "--mode" && i + 1 < args.len() {
            mode = args[i + 1].clone();
            i += 2;
            continue;
        }
        if args[i] == "--players-min" && i + 1 < args.len() {
            players_min = args[i + 1].parse().unwrap_or(2u32);
            i += 2;
            continue;
        }
        if args[i] == "--players-max" && i + 1 < args.len() {
            players_max = args[i + 1].parse().unwrap_or(10u32);
            i += 2;
            continue;
        }
        i += 1;
    }
    Args {
        out,
        trials,
        mode,
        players_min,
        players_max,
    }
}

fn exact_heads_up_preflop(hero: &[Card]) -> Result<simulate::SimResult, String> {
    if hero.len() != 2 {
        return Err("exact mode requires hero=2 cards".to_string());
    }
    let h0 = hero[0].to_idx();
    let h1 = hero[1].to_idx();
    if h0 == h1 {
        return Err("duplicate hero cards".to_string());
    }
    let deck50: Vec<usize> = (0..52).filter(|i| *i != h0 && *i != h1).collect();
    let mut win = 0u64;
    let mut tie = 0u64;
    let mut lose = 0u64;
    let mut total = 0u64;
    let mut hero_idx7 = [0usize; 7];
    let mut opp_idx7 = [0usize; 7];
    hero_idx7[0] = h0;
    hero_idx7[1] = h1;

    for i in 0..(deck50.len() - 1) {
        for j in (i + 1)..deck50.len() {
            let o0 = deck50[i];
            let o1 = deck50[j];
            opp_idx7[0] = o0;
            opp_idx7[1] = o1;
            let rem: Vec<usize> = deck50
                .iter()
                .copied()
                .filter(|c| *c != o0 && *c != o1)
                .collect();
            for a in 0..(rem.len() - 4) {
                for b in (a + 1)..(rem.len() - 3) {
                    for c in (b + 1)..(rem.len() - 2) {
                        for d in (c + 1)..(rem.len() - 1) {
                            for e in (d + 1)..rem.len() {
                                let b1 = rem[a];
                                let b2 = rem[b];
                                let b3 = rem[c];
                                let b4 = rem[d];
                                let b5 = rem[e];
                                hero_idx7[2] = b1;
                                hero_idx7[3] = b2;
                                hero_idx7[4] = b3;
                                hero_idx7[5] = b4;
                                hero_idx7[6] = b5;
                                opp_idx7[2] = b1;
                                opp_idx7[3] = b2;
                                opp_idx7[4] = b3;
                                opp_idx7[5] = b4;
                                opp_idx7[6] = b5;
                                let hs = evaluate::best_hand_score_7_indices(&hero_idx7);
                                let os = evaluate::best_hand_score_7_indices(&opp_idx7);
                                if hs < os {
                                    win += 1;
                                } else if hs > os {
                                    lose += 1;
                                } else {
                                    tie += 1;
                                }
                                total += 1;
                            }
                        }
                    }
                }
            }
        }
    }
    if total == 0 {
        return Err("no exact states enumerated".to_string());
    }
    Ok(simulate::SimResult {
        win: win as f64 / total as f64,
        tie: tie as f64 / total as f64,
        lose: lose as f64 / total as f64,
        trials: total,
        elapsed_ms: 0,
    })
}

fn main() {
    let args = parse_args();
    let out_path = args.out;
    let trials = args.trials;
    let mode = args.mode;
    let players_min = args.players_min;
    let players_max = args.players_max;
    if !(2..=10).contains(&players_min) || !(2..=10).contains(&players_max) || players_min > players_max {
        eprintln!(
            "invalid players range: {}..{} (allowed 2..10)",
            players_min, players_max
        );
        std::process::exit(1);
    }
    if mode != "monte_carlo" && mode != "exact" {
        eprintln!("invalid mode: {} (use monte_carlo or exact)", mode);
        std::process::exit(1);
    }
    if mode == "exact" && (players_min != 2 || players_max != 2) {
        eprintln!("exact mode currently supports only players=2; use --players-min 2 --players-max 2");
        std::process::exit(1);
    }
    let hand_classes = hand_class::all_hand_classes();

    let mut data: HashMap<String, HashMap<String, PreflopRow>> = HashMap::new();
    for p in players_min..=players_max {
        data.insert(p.to_string(), HashMap::new());
    }

    let total = hand_classes.len() * (players_max - players_min + 1) as usize;
    let mut done = 0usize;
    let start = std::time::Instant::now();
    let mut metric_per_hand = trials;

    for hand_class_str in &hand_classes {
        let cards = match hand_class::hand_class_to_cards(hand_class_str) {
            Some([c1, c2]) => vec![c1, c2],
            None => {
                eprintln!("Skip invalid hand class: {}", hand_class_str);
                continue;
            }
        };
        let board: Vec<texas_equity_api::cards::Card> = vec![];
        for players in players_min..=players_max {
            let result = if mode == "exact" {
                match exact_heads_up_preflop(&cards) {
                    Ok(r) => r,
                    Err(e) => {
                        eprintln!("exact: {}", e);
                        std::process::exit(1);
                    }
                }
            } else {
                simulate::simulate(players, &cards, &board, trials, None)
            };
            let row = PreflopRow {
                win: (result.win * 1e6).round() / 1e6,
                tie: (result.tie * 1e6).round() / 1e6,
                lose: (result.lose * 1e6).round() / 1e6,
            };
            metric_per_hand = result.trials;
            data.get_mut(&players.to_string())
                .unwrap()
                .insert(hand_class_str.clone(), row);
            done += 1;
            if done % 100 == 0 {
                eprintln!("Progress: {}/{} ({} @ {}p)", done, total, hand_class_str, players);
            }
        }
    }

    if let Some(parent) = out_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let payload = serde_json::json!({
        "version": "v1",
        "generatedAt": chrono::Utc::now().to_rfc3339(),
        "method": mode,
        "trialsPerHand": metric_per_hand,
        "playersMin": players_min,
        "playersMax": players_max,
        "data": data,
    });

    std::fs::write(&out_path, serde_json::to_string_pretty(&payload).unwrap()).expect("write");
    eprintln!(
        "Done. Wrote {} ({:.1}s)",
        out_path.display(),
        start.elapsed().as_secs_f64()
    );
}

#[derive(serde::Serialize)]
struct PreflopRow {
    win: f64,
    tie: f64,
    lose: f64,
}
