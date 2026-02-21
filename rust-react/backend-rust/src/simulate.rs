// Monte Carlo: run trials, return win/tie/lose. Rayon parallel, partial Fisher–Yates.

use crate::cards::{build_deck, draw_indices, seeded_rng, Card};
use crate::evaluate::best_hand_score_7;
use rayon::prelude::*;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

const PRESET_TRIALS: &[(&str, u64)] = &[
    ("fast", 50_000),
    ("standard", 200_000),
    ("high", 1_000_000),
];

pub fn trials_for_preset(preset: &str) -> u64 {
    let p = preset.to_lowercase();
    PRESET_TRIALS
        .iter()
        .find(|(k, _)| *k == p)
        .map(|(_, v)| *v)
        .unwrap_or(200_000)
}

fn run_one_trial(
    hero: &[Card],
    board_len: usize,
    deck: &mut [usize],
    num_opponents: usize,
    need_board: usize,
    rng: &mut impl FnMut() -> f64,
    scratch: &mut [usize],
    all_board: &mut [Card],
) -> u8 {
    let n_draw = num_opponents * 2 + need_board;
    draw_indices(deck, n_draw, rng, scratch);
    let mut offset = 0;
    for i in 0..need_board {
        all_board[board_len + i] = Card::from_idx(scratch[offset + i]);
    }
    offset += need_board;
    let hero_seven: Vec<Card> = hero
        .iter()
        .cloned()
        .chain(all_board.iter().cloned())
        .collect();
    let hero_score = best_hand_score_7(&hero_seven);
    let mut best_opp = 0u32;
    for _ in 0..num_opponents {
        let opp0 = Card::from_idx(scratch[offset]);
        let opp1 = Card::from_idx(scratch[offset + 1]);
        offset += 2;
        let opp_seven: Vec<Card> = vec![opp0, opp1]
            .into_iter()
            .chain(all_board.iter().cloned())
            .collect();
        let s = best_hand_score_7(&opp_seven);
        if s < best_opp || best_opp == 0 {
            best_opp = s;
        }
    }
    if hero_score < best_opp {
        0
    } else if hero_score > best_opp {
        2
    } else {
        1
    }
}

pub struct SimResult {
    pub win: f64,
    pub tie: f64,
    pub lose: f64,
    pub trials: u64,
    pub elapsed_ms: u64,
}

pub fn simulate(
    players: u32,
    hero: &[Card],
    board: &[Card],
    trials: u64,
    seed: Option<u64>,
) -> SimResult {
    let num_opponents = (players as usize).saturating_sub(1);
    let need_board = 5 - board.len();
    let known: Vec<Card> = hero.iter().chain(board.iter()).cloned().collect();
    let deck_template = build_deck(&known);
    let start = Instant::now();
    let win = AtomicU64::new(0);
    let tie = AtomicU64::new(0);
    let lose = AtomicU64::new(0);
    let num_workers = rayon::current_num_threads();
    let chunk = (trials as usize + num_workers - 1) / num_workers;
    (0..num_workers).into_par_iter().for_each(|worker_id| {
        let mut rng: Box<dyn FnMut() -> f64 + Send> = if let Some(s) = seed {
            Box::new(seeded_rng(s.wrapping_add(worker_id as u64 * 1_000_000_000)))
        } else {
            Box::new(|| rand::random::<f64>())
        };
        let n_draw = num_opponents * 2 + need_board;
        let mut scratch = vec![0usize; n_draw];
        let mut all_board: Vec<Card> = board.to_vec();
        all_board.resize(5, Card { rank: 0, suit: 0 });
        let start_idx = worker_id * chunk;
        let end_idx = (start_idx + chunk).min(trials as usize);
        let mut lwin = 0u64;
        let mut ltie = 0u64;
        let mut llose = 0u64;
        for _ in start_idx..end_idx {
            let mut deck = deck_template.clone();
            let res = run_one_trial(
                hero,
                board.len(),
                &mut deck,
                num_opponents,
                need_board,
                &mut rng,
                &mut scratch,
                &mut all_board,
            );
            match res {
                0 => lwin += 1,
                1 => ltie += 1,
                _ => llose += 1,
            }
        }
        win.fetch_add(lwin, Ordering::Relaxed);
        tie.fetch_add(ltie, Ordering::Relaxed);
        lose.fetch_add(llose, Ordering::Relaxed);
    });
    let elapsed = start.elapsed();
    let w = win.load(Ordering::Relaxed) as f64 / trials as f64;
    let t = tie.load(Ordering::Relaxed) as f64 / trials as f64;
    let l = lose.load(Ordering::Relaxed) as f64 / trials as f64;
    SimResult {
        win: w,
        tie: t,
        lose: l,
        trials,
        elapsed_ms: elapsed.as_millis() as u64,
    }
}
