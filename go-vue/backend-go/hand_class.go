// Hero 2枚から 169 ハンドクラス（AA, AKs, AKo 等）を導出。

package main

import "strings"

const rankOrder = "AKQJT98765432"

// ToHandClass は hero 2枚を正規化して hand_class を返す。
// ペアは "AA", スーテッドは "AKs", オフスートは "AKo"。
// Card.Rank は 0=A, 12=2（小さいほど高位）。
func ToHandClass(hero []Card) string {
	if len(hero) != 2 {
		return ""
	}
	c1, c2 := hero[0], hero[1]
	r1, r2 := c1.Rank, c2.Rank
	if r1 > r2 {
		r1, r2 = r2, r1
	}
	ch1 := rankOrder[r1]
	ch2 := rankOrder[r2]
	if r1 == r2 {
		return string([]byte{ch1, ch2})
	}
	suited := c1.Suit == c2.Suit
	if suited {
		return string([]byte{ch1, ch2, 's'})
	}
	return string([]byte{ch1, ch2, 'o'})
}

// AllHandClasses は 169 ハンドクラスを列挙する。
func AllHandClasses() []string {
	var out []string
	for i := 0; i < 13; i++ {
		c := rankOrder[i]
		out = append(out, string([]byte{c, c}))
	}
	for i := 0; i < 13; i++ {
		for j := i + 1; j < 13; j++ {
			hi, lo := rankOrder[i], rankOrder[j]
			out = append(out, string([]byte{hi, lo, 's'}))
			out = append(out, string([]byte{hi, lo, 'o'}))
		}
	}
	return out
}

// HandClassToCards は hand_class を代表2枚のカードに変換する。
// AA=AsAh, AKs=AsKs, AKo=AsKd 等。
func HandClassToCards(handClass string) ([]Card, bool) {
	h := handClass
	if len(h) == 2 {
		idx := strings.IndexByte(rankOrder, h[0])
		if idx < 0 || h[0] != h[1] {
			return nil, false
		}
		r := byte(idx)
		return []Card{{Rank: r, Suit: 0}, {Rank: r, Suit: 1}}, true
	}
	if len(h) != 3 {
		return nil, false
	}
	i1 := strings.IndexByte(rankOrder, h[0])
	i2 := strings.IndexByte(rankOrder, h[1])
	if i1 < 0 || i2 < 0 || i1 >= i2 {
		return nil, false
	}
	r1, r2 := byte(i1), byte(i2)
	last := h[2]
	if last == 's' || last == 'S' {
		return []Card{{Rank: r1, Suit: 0}, {Rank: r2, Suit: 0}}, true
	}
	if last == 'o' || last == 'O' {
		return []Card{{Rank: r1, Suit: 0}, {Rank: r2, Suit: 1}}, true
	}
	return nil, false
}
