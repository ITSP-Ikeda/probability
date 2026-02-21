// Monte Carlo simulation: win/tie/lose. Goroutines, partial Fisher–Yates.

package main

import (
	"math/rand"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

var presetTrials = map[string]int{
	"fast":      50_000,
	"standard":  200_000,
	"high":      1_000_000,
}

func TrialsForPreset(preset string) int {
	switch preset {
	case "fast":
		return 50000
	case "standard":
		return 200000
	case "high":
		return 1000000
	}
	return 200000
}

type SimResult struct {
	Win       float64 `json:"win"`
	Tie       float64 `json:"tie"`
	Lose      float64 `json:"lose"`
	Trials    int64   `json:"trials"`
	ElapsedMs int64   `json:"elapsedMs"`
}

func runOneTrial(hero, board []Card, deck []int, numOpponents, needBoard int, rng func() float64, scratch []int, allBoard []Card) int {
	nDraw := numOpponents*2 + needBoard
	DrawIndices(deck, nDraw, rng, scratch)
	offset := 0
	for i := 0; i < needBoard; i++ {
		allBoard[len(board)+i] = CardFromIdx(scratch[offset+i])
	}
	offset += needBoard
	heroSeven := make([]Card, 0, 7)
	heroSeven = append(heroSeven, hero...)
	heroSeven = append(heroSeven, allBoard...)
	heroScore := BestHandScore7(heroSeven)
	bestOpp := uint32(0)
	for o := 0; o < numOpponents; o++ {
		opp0 := CardFromIdx(scratch[offset])
		opp1 := CardFromIdx(scratch[offset+1])
		offset += 2
		oppSeven := []Card{opp0, opp1}
		oppSeven = append(oppSeven, allBoard...)
		s := BestHandScore7(oppSeven)
		if s < bestOpp || bestOpp == 0 {
			bestOpp = s
		}
	}
	if heroScore < bestOpp {
		return 0
	}
	if heroScore > bestOpp {
		return 2
	}
	return 1
}

func Simulate(players int, hero, board []Card, trials int, seed *int64) SimResult {
	numOpponents := players - 1
	if numOpponents < 0 {
		numOpponents = 0
	}
	needBoard := 5 - len(board)
	known := make([]Card, 0, len(hero)+len(board))
	known = append(known, hero...)
	known = append(known, board...)
	deckTemplate := BuildDeck(known)
	nDraw := numOpponents*2 + needBoard
	start := time.Now()
	var win, tie, lose int64
	numWorkers := runtime.GOMAXPROCS(0)
	if numWorkers <= 0 {
		numWorkers = 1
	}
	chunk := (trials + numWorkers - 1) / numWorkers
	var wg sync.WaitGroup
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			var rng func() float64
			if seed != nil {
				rng = SeededRNG(uint64(*seed) + uint64(workerID)*1000000000)
			} else {
				r := rand.New(rand.NewSource(time.Now().UnixNano() + int64(workerID)))
				rng = r.Float64
			}
			scratch := make([]int, nDraw)
			allBoard := make([]Card, 5)
			copy(allBoard, board)
			startIdx := workerID * chunk
			endIdx := startIdx + chunk
			if endIdx > trials {
				endIdx = trials
			}
			var lwin, ltie, llose int64
			for i := startIdx; i < endIdx; i++ {
				deck := make([]int, len(deckTemplate))
				copy(deck, deckTemplate)
				res := runOneTrial(hero, board, deck, numOpponents, needBoard, rng, scratch, allBoard)
				switch res {
				case 0:
					lwin++
				case 1:
					ltie++
				default:
					llose++
				}
			}
			atomic.AddInt64(&win, lwin)
			atomic.AddInt64(&tie, ltie)
			atomic.AddInt64(&lose, llose)
		}(w)
	}
	wg.Wait()
	elapsed := time.Since(start)
	trialsF := float64(trials)
	return SimResult{
		Win:       float64(atomic.LoadInt64(&win)) / trialsF,
		Tie:       float64(atomic.LoadInt64(&tie)) / trialsF,
		Lose:      float64(atomic.LoadInt64(&lose)) / trialsF,
		Trials:    int64(trials),
		ElapsedMs: elapsed.Milliseconds(),
	}
}

