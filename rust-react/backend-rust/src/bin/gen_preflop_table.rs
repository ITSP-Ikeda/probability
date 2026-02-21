// プリフロップ固定表を生成する CLI。起動時には実行しない。

use std::collections::HashMap;
use std::path::PathBuf;
use texas_equity_api::{hand_class, simulate};

const DEFAULT_TRIALS: u64 = 2_000_000;

fn parse_args() -> (PathBuf, u64) {
    let args: Vec<String> = std::env::args().collect();
    let mut out = PathBuf::from("assets/data/preflop_table.v1.json");
    let mut trials = DEFAULT_TRIALS;
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
        i += 1;
    }
    (out, trials)
}

fn main() {
    let (out_path, trials) = parse_args();
    let hand_classes = hand_class::all_hand_classes();
    let players_min = 2u32;
    let players_max = 10u32;

    let mut data: HashMap<String, HashMap<String, PreflopRow>> = HashMap::new();
    for p in players_min..=players_max {
        data.insert(p.to_string(), HashMap::new());
    }

    let total = hand_classes.len() * (players_max - players_min + 1) as usize;
    let mut done = 0usize;
    let start = std::time::Instant::now();

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
            let result = simulate::simulate(players, &cards, &board, trials, None);
            let row = PreflopRow {
                win: (result.win * 1e6).round() / 1e6,
                tie: (result.tie * 1e6).round() / 1e6,
                lose: (result.lose * 1e6).round() / 1e6,
            };
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
        "method": "monte_carlo",
        "trialsPerHand": trials,
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
