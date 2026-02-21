// プリフロップ固定表の読み込みと参照。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflopRow {
    pub win: f64,
    pub tie: f64,
    pub lose: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflopTable {
    pub version: String,
    pub generated_at: Option<String>,
    pub method: String,
    pub trials_per_hand: u64,
    pub players_min: Option<u32>,
    pub players_max: Option<u32>,
    pub data: HashMap<String, HashMap<String, PreflopRow>>,
}

impl PreflopTable {
    pub fn trials_per_hand(&self) -> u64 {
        self.trials_per_hand
    }

    pub fn get(&self, players: u32, hand_class: &str) -> Option<&PreflopRow> {
        self.data.get(&players.to_string())?.get(hand_class)
    }
}

/// 指定パスから JSON を読み込む。失敗時は None。
pub fn load_preflop_table(path: &Path) -> Option<PreflopTable> {
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}
