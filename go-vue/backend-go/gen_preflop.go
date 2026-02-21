// プリフロップ固定表生成（gen-preflop サブコマンド）。

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const defaultTrials = 2_000_000

func runGenPreflop(args []string) {
	fs := flag.NewFlagSet("gen-preflop", flag.ExitOnError)
	out := fs.String("out", "assets/data/preflop_table.v1.json", "output JSON path")
	trials := fs.Int64("trials", defaultTrials, "trials per hand")
	_ = fs.Parse(args)

	handClasses := AllHandClasses()
	playersMin, playersMax := 2, 10

	data := make(map[string]map[string]PreflopRow)
	for p := playersMin; p <= playersMax; p++ {
		data[fmt.Sprintf("%d", p)] = make(map[string]PreflopRow)
	}

	total := len(handClasses) * (playersMax - playersMin + 1)
	done := 0
	start := time.Now()

	for _, handClass := range handClasses {
		cards, ok := HandClassToCards(handClass)
		if !ok || len(cards) != 2 {
			fmt.Fprintf(os.Stderr, "Skip invalid hand class: %s\n", handClass)
			continue
		}
		board := []Card{}
		for players := playersMin; players <= playersMax; players++ {
			result := Simulate(players, cards, board, int(*trials), nil)
			data[fmt.Sprintf("%d", players)][handClass] = PreflopRow{
				Win:  round6(result.Win),
				Tie:  round6(result.Tie),
				Lose: round6(result.Lose),
			}
			done++
			if done%100 == 0 {
				fmt.Fprintf(os.Stderr, "Progress: %d/%d (%s @ %dp)\n", done, total, handClass, players)
			}
		}
	}

	if err := os.MkdirAll(filepath.Dir(*out), 0755); err != nil {
		fmt.Fprintf(os.Stderr, "mkdir: %v\n", err)
		os.Exit(1)
	}

	payload := map[string]interface{}{
		"version":       "v1",
		"generatedAt":   time.Now().UTC().Format(time.RFC3339),
		"method":        "monte_carlo",
		"trialsPerHand": *trials,
		"playersMin":    playersMin,
		"playersMax":    playersMax,
		"data":          data,
	}
	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "json: %v\n", err)
		os.Exit(1)
	}
	if err := os.WriteFile(*out, raw, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "write: %v\n", err)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "Done. Wrote %s (%.1fs)\n", *out, time.Since(start).Seconds())
}
