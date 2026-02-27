package main

import "fmt"

// ExactHeadsUpPreflop は hero 2枚・board 0枚のヘッズアップ厳密値を全列挙で返す。
func ExactHeadsUpPreflop(hero []Card) (SimResult, error) {
	if len(hero) != 2 {
		return SimResult{}, fmt.Errorf("exact mode requires hero=2 cards")
	}
	h0 := hero[0].Idx()
	h1 := hero[1].Idx()
	if h0 == h1 {
		return SimResult{}, fmt.Errorf("duplicate hero cards")
	}

	deck50 := make([]int, 0, 50)
	for i := 0; i < 52; i++ {
		if i == h0 || i == h1 {
			continue
		}
		deck50 = append(deck50, i)
	}

	var win, tie, lose int64
	var total int64
	heroSeven := make([]Card, 7)
	oppSeven := make([]Card, 7)
	heroSeven[0], heroSeven[1] = hero[0], hero[1]

	for i := 0; i < len(deck50)-1; i++ {
		for j := i + 1; j < len(deck50); j++ {
			opp0 := CardFromIdx(deck50[i])
			opp1 := CardFromIdx(deck50[j])
			oppSeven[0], oppSeven[1] = opp0, opp1

			rem := make([]int, 0, 48)
			for _, c := range deck50 {
				if c != deck50[i] && c != deck50[j] {
					rem = append(rem, c)
				}
			}

			for a := 0; a < len(rem)-4; a++ {
				b1 := CardFromIdx(rem[a])
				for b := a + 1; b < len(rem)-3; b++ {
					b2 := CardFromIdx(rem[b])
					for c := b + 1; c < len(rem)-2; c++ {
						b3 := CardFromIdx(rem[c])
						for d := c + 1; d < len(rem)-1; d++ {
							b4 := CardFromIdx(rem[d])
							for e := d + 1; e < len(rem); e++ {
								b5 := CardFromIdx(rem[e])

								heroSeven[2], heroSeven[3], heroSeven[4], heroSeven[5], heroSeven[6] = b1, b2, b3, b4, b5
								oppSeven[2], oppSeven[3], oppSeven[4], oppSeven[5], oppSeven[6] = b1, b2, b3, b4, b5
								hs := BestHandScore7(heroSeven)
								os := BestHandScore7(oppSeven)

								if hs < os {
									win++
								} else if hs > os {
									lose++
								} else {
									tie++
								}
								total++
							}
						}
					}
				}
			}
		}
	}

	if total == 0 {
		return SimResult{}, fmt.Errorf("no exact states enumerated")
	}
	tf := float64(total)
	return SimResult{
		Win:       float64(win) / tf,
		Tie:       float64(tie) / tf,
		Lose:      float64(lose) / tf,
		Trials:    total,
		ElapsedMs: 0,
	}, nil
}
