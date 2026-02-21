package main

import "testing"

func TestParseCard(t *testing.T) {
	c, err := ParseCard("As")
	if err != nil {
		t.Fatal(err)
	}
	if c.Rank != 12 || c.Suit != 0 {
		t.Errorf("As: rank=%d suit=%d", c.Rank, c.Suit)
	}
	_, err = ParseCard("1s")
	if err == nil {
		t.Error("expected error for 1s")
	}
}

func TestValidateInput(t *testing.T) {
	hero, _ := ParseCards("As Kd")
	board := []Card{}
	if err := ValidateInput(hero, board); err != nil {
		t.Fatal(err)
	}
	board1, _ := ParseCards("7h")
	if err := ValidateInput(hero, board1); err == nil {
		t.Error("expected error for board len 1")
	}
}

func TestSeededRNG(t *testing.T) {
	r1 := SeededRNG(12345)
	r2 := SeededRNG(12345)
	for i := 0; i < 5; i++ {
		if r1() != r2() {
			t.Error("seed reproducibility failed")
		}
	}
}
