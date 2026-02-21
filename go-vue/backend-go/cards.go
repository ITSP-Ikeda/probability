// Package texas-equity-api: card parse, validation, deck, partial Fisher–Yates.
// Format: "As", "Td", "7h" (Rank: A,K,Q,J,T,9..2 / Suit: s,h,d,c)

package main

import (
	"fmt"
	"strings"
	"unicode"
)

const ranks = "AKQJT98765432"
const suits = "shdc"

type Card struct {
	Rank byte // 0=2, 12=A
	Suit byte // 0=s,1=h,2=d,3=c
}

func (c Card) Idx() int { return int(c.Suit)*13 + int(c.Rank) }

func CardFromIdx(idx int) Card {
	return Card{Suit: byte(idx / 13), Rank: byte(idx % 13)}
}

func (c Card) String() string {
	return string([]byte{ranks[c.Rank], suits[c.Suit]})
}

type ValidationError struct {
	Error_  string  `json:"error"`
	Details *string `json:"details,omitempty"`
	Card    *string `json:"card,omitempty"`
}

func ParseCard(s string) (Card, *ValidationError) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "10", "T")
	if len(s) != 2 {
		det := fmt.Sprintf("Card must be 2 chars (e.g. As, Td), got: %s", s)
		return Card{}, &ValidationError{"invalid_card_length", &det, &s}
	}
	r := rune(s[0])
	if unicode.IsLower(r) {
		r = unicode.ToUpper(r)
	}
	rankIdx := strings.IndexRune(ranks, r)
	if rankIdx < 0 {
		det := fmt.Sprintf("Rank must be one of %s, got: %c", ranks, r)
		return Card{}, &ValidationError{"invalid_rank", &det, &s}
	}
	suitCh := s[1]
	if suitCh >= 'A' && suitCh <= 'Z' {
		suitCh += 'a' - 'A'
	}
	suitIdx := strings.IndexByte(suits, suitCh)
	if suitIdx < 0 {
		det := fmt.Sprintf("Suit must be s,h,d,c, got: %c", suitCh)
		return Card{}, &ValidationError{"invalid_suit", &det, &s}
	}
	return Card{Rank: byte(rankIdx), Suit: byte(suitIdx)}, nil
}

func ParseCards(s string) ([]Card, *ValidationError) {
	var out []Card
	for _, p := range strings.Fields(s) {
		if p == "" {
			continue
		}
		c, err := ParseCard(p)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func ValidateInput(hero, board []Card) *ValidationError {
	if len(hero) != 2 {
		det := "hero must be exactly 2 cards"
		return &ValidationError{"invalid_hero", &det, nil}
	}
	allowed := map[int]bool{0: true, 3: true, 4: true, 5: true}
	if !allowed[len(board)] {
		det := fmt.Sprintf("board must have 0,3,4,5 cards, got %d", len(board))
		return &ValidationError{"invalid_board_length", &det, nil}
	}
	seen := make(map[int]bool)
	for _, c := range hero {
		idx := c.Idx()
		if seen[idx] {
			s := c.String()
			det := fmt.Sprintf("Duplicate card: %s", s)
			return &ValidationError{"duplicate_cards", &det, &s}
		}
		seen[idx] = true
	}
	for _, c := range board {
		idx := c.Idx()
		if seen[idx] {
			s := c.String()
			det := fmt.Sprintf("Duplicate card: %s", s)
			return &ValidationError{"duplicate_cards", &det, &s}
		}
		seen[idx] = true
	}
	return nil
}

func BuildDeck(known []Card) []int {
	set := make(map[int]bool)
	for _, c := range known {
		set[c.Idx()] = true
	}
	var deck []int
	for i := 0; i < 52; i++ {
		if !set[i] {
			deck = append(deck, i)
		}
	}
	return deck
}

// DrawIndices: partial Fisher–Yates, draw n from deck (mutated), write to out.
func DrawIndices(deck []int, n int, rng func() float64, out []int) {
	for i := 0; i < n; i++ {
		j := i + int(rng()*float64(len(deck)-i))
		deck[i], deck[j] = deck[j], deck[i]
		out[i] = deck[i]
	}
}

// SeededRNG returns a deterministic RNG for reproducibility.
func SeededRNG(seed uint64) func() float64 {
	s := seed
	return func() float64 {
		s = s*1664525 + 1013904223
		return float64(s>>32) / (1 << 32)
	}
}
