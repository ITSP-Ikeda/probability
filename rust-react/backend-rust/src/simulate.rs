// Monte Carlo: run trials, return win/tie/lose. Rayon parallel, partial Fisher–Yates.

use crate::cards::{build_deck, draw_indices, Card};
use crate::evaluate::best_hand_score_7_indices;
use rand::Rng;
use rayon::prelude::*;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

/// RNG per worker: concrete type to avoid Box<dyn FnMut> and vtable cost.
enum WorkerRng {
    Seeded(u64),
    Thread(rand::rngs::ThreadRng),
}

impl WorkerRng {
    fn new(seed: Option<u64>, worker_id: usize) -> Self {
        match seed {
            Some(s) => WorkerRng::Seeded(s.wrapping_add(worker_id as u64 * 1_000_000_000)),
            None => WorkerRng::Thread(rand::rngs::ThreadRng::default()),
        }
    }

    fn next_f64(&mut self) -> f64 {
        match self {
            WorkerRng::Seeded(s) => {
                *s = s.wrapping_mul(1664525).wrapping_add(1013904223);
                (*s >> 32) as f64 / (1u64 << 32) as f64
            }
            WorkerRng::Thread(r) => r.gen(),
        }
    }
}

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
    seven_buf: &mut [Card; 7],
) -> u8 {
    let n_draw = num_opponents * 2 + need_board;
    draw_indices(deck, n_draw, rng, scratch);
    let mut offset = 0;
    for i in 0..need_board {
        all_board[board_len + i] = Card::from_idx(scratch[offset + i]);
    }
    offset += need_board;
    seven_buf[0] = hero[0];
    seven_buf[1] = hero[1];
    for (i, c) in all_board.iter().enumerate() {
        seven_buf[2 + i] = *c;
    }
    let mut idx7 = [0usize; 7];
    for (i, c) in seven_buf.iter().enumerate() {
        idx7[i] = c.to_idx();
    }
    let hero_score = best_hand_score_7_indices(&idx7);
    let mut best_opp = 0u32;
    for _ in 0..num_opponents {
        seven_buf[0] = Card::from_idx(scratch[offset]);
        seven_buf[1] = Card::from_idx(scratch[offset + 1]);
        offset += 2;
        for (i, c) in all_board.iter().enumerate() {
            seven_buf[2 + i] = *c;
        }
        for (i, c) in seven_buf.iter().enumerate() {
            idx7[i] = c.to_idx();
        }
        let s = best_hand_score_7_indices(&idx7);
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
        let mut rng = WorkerRng::new(seed, worker_id);
        let n_draw = num_opponents * 2 + need_board;
        let mut scratch = vec![0usize; n_draw];
        let mut all_board: Vec<Card> = board.to_vec();
        all_board.resize(5, Card { rank: 0, suit: 0 });
        let deck_template = deck_template.clone();
        let mut deck = deck_template.clone();
        let mut seven_buf = [Card { rank: 0, suit: 0 }; 7];
        let start_idx = worker_id * chunk;
        let end_idx = (start_idx + chunk).min(trials as usize);
        let mut lwin = 0u64;
        let mut ltie = 0u64;
        let mut llose = 0u64;
        for _ in start_idx..end_idx {
            deck.copy_from_slice(&deck_template);
            let res = run_one_trial(
                hero,
                board.len(),
                &mut deck,
                num_opponents,
                need_board,
                &mut || rng.next_f64(),
                &mut scratch,
                &mut all_board,
                &mut seven_buf,
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
