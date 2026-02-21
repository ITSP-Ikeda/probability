// Hero 2枚から 169 ハンドクラス（AA, AKs, AKo 等）を導出。

use crate::cards::Card;

const RANKS: &str = "AKQJT98765432";

/// Hero 2枚を正規化して hand_class を返す。ペアは "AA", スーテッドは "AKs", オフスートは "AKo"。
pub fn to_hand_class(hero: &[Card]) -> Option<String> {
    if hero.len() != 2 {
        return None;
    }
    let c1 = &hero[0];
    let c2 = &hero[1];
    let (r1, r2) = if c1.rank >= c2.rank {
        (c1.rank, c2.rank)
    } else {
        (c2.rank, c1.rank)
    };
    let ch1 = RANKS.chars().nth(r1 as usize)?;
    let ch2 = RANKS.chars().nth(r2 as usize)?;
    if r1 == r2 {
        return Some(format!("{}{}", ch1, ch2));
    }
    let suited = c1.suit == c2.suit;
    Some(format!("{}{}{}", ch1, ch2, if suited { "s" } else { "o" }))
}

/// 169 ハンドクラスを列挙（ペア・suited・offsuit の順）。
pub fn all_hand_classes() -> Vec<String> {
    let mut out = Vec::with_capacity(169);
    for i in 0..13 {
        let c = RANKS.chars().nth(i).unwrap();
        out.push(format!("{}{}", c, c));
    }
    for i in 0..13 {
        for j in (i + 1)..13 {
            let hi = RANKS.chars().nth(i).unwrap();
            let lo = RANKS.chars().nth(j).unwrap();
            out.push(format!("{}{}s", hi, lo));
            out.push(format!("{}{}o", hi, lo));
        }
    }
    out
}

/// hand_class を代表2枚の Card に変換。AA=AsAh, AKs=AsKs, AKo=AsKd 等。
pub fn hand_class_to_cards(hand_class: &str) -> Option<[Card; 2]> {
    let h = hand_class.trim();
    let mut chars = h.chars();
    let c1 = chars.next()?.to_ascii_uppercase();
    let c2 = chars.next()?.to_ascii_uppercase();
    let r1 = RANKS.find(c1)? as u8;
    let r2 = RANKS.find(c2)? as u8;
    if h.len() == 2 {
        if r1 != r2 {
            return None;
        }
        return Some([Card { rank: r1, suit: 0 }, Card { rank: r1, suit: 1 }]);
    }
    if h.len() != 3 {
        return None;
    }
    let last = chars.next()?.to_ascii_lowercase();
    if last == 's' {
        Some([Card { rank: r1, suit: 0 }, Card { rank: r2, suit: 0 }])
    } else if last == 'o' {
        Some([Card { rank: r1, suit: 0 }, Card { rank: r2, suit: 1 }])
    } else {
        None
    }
}

trait ToAscii {
    fn to_ascii_uppercase(self) -> char;
    fn to_ascii_lowercase(self) -> char;
}
impl ToAscii for char {
    fn to_ascii_uppercase(self) -> char {
        self.to_uppercase().next().unwrap_or(self)
    }
    fn to_ascii_lowercase(self) -> char {
        self.to_lowercase().next().unwrap_or(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_hand_class() {
        let a = Card { rank: 12, suit: 0 };
        let k = Card { rank: 11, suit: 1 };
        assert_eq!(to_hand_class(&[a, k]), Some("AKo".into()));
        assert_eq!(to_hand_class(&[k, a]), Some("AKo".into()));
        let a2 = Card { rank: 12, suit: 1 };
        assert_eq!(to_hand_class(&[a, a2]), Some("AA".into()));
    }
}
