// 7-card -> best 5-card hand score (lower = stronger, for comparison).

use crate::cards::Card;

/// Card index 0-51: suit*13 + rank (rank 0=2, 12=A).
fn card_idx(c: &Card) -> usize {
    c.to_idx()
}

/// Evaluate 5 cards (indices 0-51). Lower score = stronger hand.
fn eval5(indices: &[usize; 5]) -> u32 {
    let mut ranks = [0u8; 5];
    let mut suits = [0u8; 5];
    for (i, &idx) in indices.iter().enumerate() {
        ranks[i] = (idx % 13) as u8;
        suits[i] = (idx / 13) as u8;
    }
    ranks.sort_by(|a, b| b.cmp(a)); // descending
    let is_flush = suits[0] == suits[1] && suits[1] == suits[2] && suits[2] == suits[3] && suits[3] == suits[4];
    let mut rank_counts: [(u8, u8); 5] = [(0, 0); 5];
    let mut rc_len = 0usize;
    let mut r = ranks[0];
    let mut count = 1u8;
    for i in 1..5 {
        if ranks[i] == r {
            count += 1;
        } else {
            rank_counts[rc_len] = (r, count);
            rc_len += 1;
            r = ranks[i];
            count = 1;
        }
    }
    rank_counts[rc_len] = (r, count);
    rc_len += 1;
    rank_counts[..rc_len].sort_by(|a, b| b.1.cmp(&a.1).then(b.0.cmp(&a.0)));
    let is_straight = {
        let mut s = ranks;
        s.sort();
        let a = s[0];
        (s[1] == a + 1 && s[2] == a + 2 && s[3] == a + 3 && s[4] == a + 4)
            || (s[0] == 0 && s[1] == 1 && s[2] == 2 && s[3] == 3 && s[4] == 12) // wheel A-2-3-4-5
    };
    let type_score: u32 = if is_flush && is_straight {
        0
    } else if rc_len > 0 && rank_counts[0].1 == 4 {
        1
    } else if rc_len >= 2 && rank_counts[0].1 == 3 && rank_counts[1].1 == 2 {
        2
    } else if is_flush {
        3
    } else if is_straight {
        4
    } else if rc_len > 0 && rank_counts[0].1 == 3 {
        5
    } else if rc_len >= 2 && rank_counts[0].1 == 2 && rank_counts[1].1 == 2 {
        6
    } else if rc_len > 0 && rank_counts[0].1 == 2 {
        7
    } else {
        8
    };
    let kicker: u32 = ranks.iter().enumerate().map(|(i, &r)| (r as u32) << (4 * (4 - i))).sum();
    (type_score << 24) | kicker
}

/// Best 5-card hand from 7 cards (indices 0-51). Lower = stronger. No heap allocation.
pub fn best_hand_score_7_indices(indices: &[usize; 7]) -> u32 {
    let mut best = u32::MAX;
    let mut c = [0usize; 5];
    for i in 0..7 {
        for j in (i + 1)..7 {
            let mut k = 0;
            for p in 0..7 {
                if p != i && p != j {
                    c[k] = indices[p];
                    k += 1;
                }
            }
            let score = eval5(&[c[0], c[1], c[2], c[3], c[4]]);
            if score < best {
                best = score;
            }
        }
    }
    best
}

/// Best 5-card hand from 7 cards. Lower = stronger. Kept for API compatibility.
pub fn best_hand_score_7(cards: &[Card]) -> u32 {
    if cards.len() != 7 {
        return u32::MAX;
    }
    let mut idx = [0usize; 7];
    for (i, c) in cards.iter().enumerate() {
        idx[i] = card_idx(c);
    }
    best_hand_score_7_indices(&idx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards::parse_card;

    #[test]
    fn test_royal_flush_beats_high_card() {
        let royal: Vec<Card> = ["As", "Ks", "Qs", "Js", "Ts", "2c", "3d"]
            .iter()
            .map(|s| parse_card(s).unwrap())
            .collect();
        let high: Vec<Card> = ["Ah", "Kd", "Qc", "Jh", "Td", "2s", "3c"]
            .iter()
            .map(|s| parse_card(s).unwrap())
            .collect();
        assert!(best_hand_score_7(&royal) < best_hand_score_7(&high));
    }
}
