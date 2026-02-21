// プリフロップ固定表の読み込みと参照。

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
)

type PreflopRow struct {
	Win  float64 `json:"win"`
	Tie  float64 `json:"tie"`
	Lose float64 `json:"lose"`
}

type PreflopTable struct {
	Version       string                        `json:"version"`
	GeneratedAt   string                        `json:"generatedAt"`
	Method        string                        `json:"method"`
	TrialsPerHand int64                         `json:"trialsPerHand"`
	PlayersMin    int                           `json:"playersMin"`
	PlayersMax    int                           `json:"playersMax"`
	Data          map[string]map[string]PreflopRow `json:"data"`
}

// LoadPreflopTable は path から JSON を読み込む。失敗時は nil。
func LoadPreflopTable(path string) *PreflopTable {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var t PreflopTable
	if err := json.Unmarshal(raw, &t); err != nil {
		return nil
	}
	return &t
}

func (t *PreflopTable) Get(players int, handClass string) (PreflopRow, bool) {
	if t == nil || t.Data == nil {
		return PreflopRow{}, false
	}
	byPlayers, ok := t.Data[strconv.Itoa(players)]
	if !ok {
		return PreflopRow{}, false
	}
	row, ok := byPlayers[handClass]
	return row, ok
}

// FindPreflopTablePath は起動時に固定表を探すパスを返す。
func FindPreflopTablePath() string {
	cwd, _ := os.Getwd()
	candidates := []string{
		filepath.Join(cwd, "assets", "data", "preflop_table.v1.json"),
		filepath.Join(cwd, "data", "preflop_table.v1.json"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}
