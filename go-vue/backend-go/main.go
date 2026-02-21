package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

var preflopTable *PreflopTable

type EquityRequest struct {
	Players int      `json:"players"`
	Hero    []string `json:"hero"`
	Board   []string `json:"board"`
	Preset  string   `json:"preset"`
	Seed    *int64   `json:"seed"`
}

type EquityResponse struct {
	Win       float64 `json:"win"`
	Tie       float64 `json:"tie"`
	Lose      float64 `json:"lose"`
	Trials    int64   `json:"trials"`
	ElapsedMs int64   `json:"elapsedMs"`
	Method    string  `json:"method,omitempty"`
	Note      string  `json:"note,omitempty"`
}

type ErrorResponse struct {
	Error   string  `json:"error"`
	Details *string `json:"details,omitempty"`
	Card    *string `json:"card,omitempty"`
}

func main() {
	if len(os.Args) >= 2 && os.Args[1] == "gen-preflop" {
		runGenPreflop(os.Args[2:])
		return
	}

	preflopTable = LoadPreflopTable(FindPreflopTablePath())

	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "dist"
	}

	e.POST("/api/equity", equityHandler)
	e.GET("/api/preflop-table", preflopTableHandler)
	e.Static("/assets", filepath.Join(staticDir, "assets"))
	e.GET("/*", spaIndex(staticDir))

	e.Logger.Fatal(e.Start(":8080"))
}

func spaIndex(staticDir string) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := filepath.Join(staticDir, "index.html")
		return c.File(path)
	}
}

func equityHandler(c echo.Context) error {
	var body EquityRequest
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_json", Details: strPtr(err.Error())})
	}
	if body.Players < 2 || body.Players > 10 {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_players", Details: strPtr("players must be between 2 and 10")})
	}
	if len(body.Hero) != 2 {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_hero", Details: strPtr("hero must be exactly 2 cards")})
	}
	var hero []Card
	for _, s := range body.Hero {
		card, err := ParseCard(s)
		if err != nil {
			return c.JSON(http.StatusBadRequest, err)
		}
		hero = append(hero, card)
	}
	var board []Card
	for _, s := range body.Board {
		card, err := ParseCard(s)
		if err != nil {
			return c.JSON(http.StatusBadRequest, err)
		}
		board = append(board, card)
	}
	if err := ValidateInput(hero, board); err != nil {
		return c.JSON(http.StatusBadRequest, err)
	}

	if len(board) == 0 {
		handClass := ToHandClass(hero)
		if handClass == "" {
			return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_hero", Details: strPtr("could not derive hand class from hero cards")})
		}
		if preflopTable != nil {
			if row, ok := preflopTable.Get(body.Players, handClass); ok {
				note := ""
				if body.Preset != "standard" || body.Seed != nil {
					note = "preset and seed are ignored when using preflop table"
				}
				return c.JSON(http.StatusOK, EquityResponse{
					Win:       round6(row.Win),
					Tie:       round6(row.Tie),
					Lose:      round6(row.Lose),
					Trials:    preflopTable.TrialsPerHand,
					ElapsedMs: 0,
					Method:    "preflop_table",
					Note:      note,
				})
			}
		}
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "preflop_table_not_generated",
			Details: strPtr("preflop table not generated. Run: go run . gen-preflop --out ./assets/data/preflop_table.v1.json --trials 2000000"),
		})
	}

	trials := TrialsForPreset(body.Preset)
	result := Simulate(body.Players, hero, board, trials, body.Seed)
	return c.JSON(http.StatusOK, EquityResponse{
		Win:       round6(result.Win),
		Tie:       round6(result.Tie),
		Lose:      round6(result.Lose),
		Trials:    result.Trials,
		ElapsedMs: result.ElapsedMs,
		Method:    "monte_carlo",
	})
}

func preflopTableHandler(c echo.Context) error {
	playersStr := c.QueryParam("players")
	if playersStr == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_players", Details: strPtr("players query param required (2-10)")})
	}
	var players int
	if _, err := fmt.Sscanf(playersStr, "%d", &players); err != nil || players < 2 || players > 10 {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_players", Details: strPtr("players must be between 2 and 10")})
	}
	if preflopTable == nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "preflop_table_not_generated", Details: strPtr("preflop table not generated.")})
	}
	key := strconv.Itoa(players)
	data, ok := preflopTable.Data[key]
	if !ok {
		return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "preflop_table_missing_players", Details: strPtr("no data for players=" + playersStr)})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"players":       players,
		"trialsPerHand": preflopTable.TrialsPerHand,
		"data":         data,
	})
}

func strPtr(s string) *string { return &s }

func round6(x float64) float64 {
	return float64(int(x*1e6+0.5)) / 1e6
}
