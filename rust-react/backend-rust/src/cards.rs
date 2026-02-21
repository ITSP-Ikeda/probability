// Card parsing, validation, deck building, partial Fisher–Yates.
// Format: "As", "Td", "7h" (Rank: A,K,Q,J,T,9..2 / Suit: s,h,d,c)

const RANKS: &str = "AKQJT98765432";
const SUITS: &str = "shdc";

#[derive(Debug, Clone)]
pub struct Card {
    pub rank: u8,  // 0=2, 12=A
    pub suit: u8,  // 0=s,1=h,2=d,3=c
}

impl Card {
    pub fn to_idx(&self) -> usize {
        (self.suit as usize) * 13 + (self.rank as usize)
    }
    pub fn from_idx(idx: usize) -> Self {
        Card {
            suit: (idx / 13) as u8,
            rank: (idx % 13) as u8,
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct ValidationError {
    pub error: String,
    pub details: Option<String>,
    pub card: Option<String>,
}

pub fn parse_card(s: &str) -> Result<Card, ValidationError> {
    let t = s.trim().replace("10", "T");
    if t.len() != 2 {
        return Err(ValidationError {
            error: "invalid_card_length".into(),
            details: Some(format!("Card must be 2 chars (e.g. As, Td), got: {}", s)),
            card: Some(s.into()),
        });
    }
    let rank_ch = t.chars().next().unwrap().to_ascii_uppercase();
    let suit_ch = t.chars().nth(1).unwrap().to_ascii_lowercase();
    let rank = RANKS.find(rank_ch).ok_or_else(|| ValidationError {
        error: "invalid_rank".into(),
        details: Some(format!("Rank must be one of {}, got: {}", RANKS, rank_ch)),
        card: Some(s.into()),
    })? as u8;
    let suit = SUITS.find(suit_ch).ok_or_else(|| ValidationError {
        error: "invalid_suit".into(),
        details: Some(format!("Suit must be s,h,d,c, got: {}", suit_ch)),
        card: Some(s.into()),
    })? as u8;
    Ok(Card { rank, suit })
}

pub fn parse_cards(s: &str) -> Result<Vec<Card>, ValidationError> {
    let mut out = Vec::new();
    for p in s.split_whitespace() {
        if p.is_empty() {
            continue;
        }
        out.push(parse_card(p)?);
    }
    Ok(out)
}

pub fn card_to_string(c: &Card) -> String {
    format!(
        "{}{}",
        RANKS.chars().nth(c.rank as usize).unwrap(),
        SUITS.chars().nth(c.suit as usize).unwrap()
    )
}

pub fn validate_input(hero: &[Card], board: &[Card]) -> Result<(), ValidationError> {
    if hero.len() != 2 {
        return Err(ValidationError {
            error: "invalid_hero".into(),
            details: Some("hero must be exactly 2 cards".into()),
            card: None,
        });
    }
    let allowed = [0, 3, 4, 5];
    if !allowed.contains(&board.len()) {
        return Err(ValidationError {
            error: "invalid_board_length".into(),
            details: Some(format!("board must have 0,3,4,5 cards, got {}", board.len())),
            card: None,
        });
    }
    let mut seen = std::collections::HashSet::new();
    for c in hero.iter().chain(board.iter()) {
        let idx = c.to_idx();
        if !seen.insert(idx) {
            return Err(ValidationError {
                error: "duplicate_cards".into(),
                details: Some(format!("Duplicate card: {}", card_to_string(c))),
                card: Some(card_to_string(c)),
            });
        }
    }
    Ok(())
}

pub fn build_deck(known: &[Card]) -> Vec<usize> {
    let set: std::collections::HashSet<usize> = known.iter().map(|c| c.to_idx()).collect();
    (0..52).filter(|i| !set.contains(i)).collect()
}

/// Partial Fisher–Yates: draw `n` indices from `deck` in place, write drawn indices to `out`.
pub fn draw_indices(deck: &mut [usize], n: usize, rng: &mut impl FnMut() -> f64, out: &mut [usize]) {
    for i in 0..n {
        let j = i + (rng() * (deck.len() - i) as f64) as usize;
        deck.swap(i, j);
        out[i] = deck[i];
    }
}

/// Seeded RNG (LCG) for reproducibility.
pub fn seeded_rng(seed: u64) -> impl FnMut() -> f64 {
    let mut s = seed;
    move || {
        s = s.wrapping_mul(1664525).wrapping_add(1013904223);
        (s >> 32) as f64 / (1u64 << 32) as f64
    }
}

trait ToAscii {
    fn to_ascii_uppercase(&self) -> char;
    fn to_ascii_lowercase(&self) -> char;
}
impl ToAscii for char {
    fn to_ascii_uppercase(&self) -> char {
        self.to_uppercase().next().unwrap_or(*self)
    }
    fn to_ascii_lowercase(&self) -> char {
        self.to_lowercase().next().unwrap_or(*self)
    }
}
