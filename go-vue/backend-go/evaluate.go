package main

func eval5(idx [5]int) uint32 {
	var ranks [5]byte
	var suits [5]byte
	for i := 0; i < 5; i++ {
		ranks[i] = byte(idx[i] % 13)
		suits[i] = byte(idx[i] / 13)
	}
	for i := 0; i < 5; i++ {
		for j := i + 1; j < 5; j++ {
			if ranks[j] > ranks[i] {
				ranks[i], ranks[j] = ranks[j], ranks[i]
			}
		}
	}
	isFlush := suits[0] == suits[1] && suits[1] == suits[2] && suits[2] == suits[3] && suits[3] == suits[4]
	type rc struct{ rank, count byte }
	var counts []rc
	r, cnt := ranks[0], byte(1)
	for i := 1; i < 5; i++ {
		if ranks[i] == r {
			cnt++
		} else {
			counts = append(counts, rc{r, cnt})
			r, cnt = ranks[i], 1
		}
	}
	counts = append(counts, rc{r, cnt})
	for i := 0; i < len(counts); i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[j].count > counts[i].count || (counts[j].count == counts[i].count && counts[j].rank > counts[i].rank) {
				counts[i], counts[j] = counts[j], counts[i]
			}
		}
	}
	var s [5]byte
	for i := 0; i < 5; i++ {
		s[i] = ranks[i]
	}
	for i := 0; i < 5; i++ {
		for j := i + 1; j < 5; j++ {
			if s[j] < s[i] {
				s[i], s[j] = s[j], s[i]
			}
		}
	}
	isStraight := (s[1] == s[0]+1 && s[2] == s[0]+2 && s[3] == s[0]+3 && s[4] == s[0]+4) || (s[0] == 0 && s[1] == 1 && s[2] == 2 && s[3] == 3 && s[4] == 12)
	var typeScore uint32
	if isFlush && isStraight {
		typeScore = 0
	} else if len(counts) > 0 && counts[0].count == 4 {
		typeScore = 1
	} else if len(counts) >= 2 && counts[0].count == 3 && counts[1].count == 2 {
		typeScore = 2
	} else if isFlush {
		typeScore = 3
	} else if isStraight {
		typeScore = 4
	} else if len(counts) > 0 && counts[0].count == 3 {
		typeScore = 5
	} else if len(counts) >= 2 && counts[0].count == 2 && counts[1].count == 2 {
		typeScore = 6
	} else if len(counts) > 0 && counts[0].count == 2 {
		typeScore = 7
	} else {
		typeScore = 8
	}
	kicker := uint32(ranks[0])<<16 | uint32(ranks[1])<<12 | uint32(ranks[2])<<8 | uint32(ranks[3])<<4 | uint32(ranks[4])
	return typeScore<<24 | kicker
}

func BestHandScore7(cards []Card) uint32 {
	if len(cards) != 7 {
		return 0xffffffff
	}
	idx := make([]int, 7)
	for i := range cards {
		idx[i] = cards[i].Idx()
	}
	best := uint32(0xffffffff)
	var c [5]int
	for i := 0; i < 7; i++ {
		for j := i + 1; j < 7; j++ {
			k := 0
			for p := 0; p < 7; p++ {
				if p != i && p != j {
					c[k] = idx[p]
					k++
				}
			}
			s := eval5(c)
			if s < best {
				best = s
			}
		}
	}
	return best
}
