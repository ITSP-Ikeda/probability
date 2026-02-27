.PHONY: gen-preflop

TRIALS ?= 2000000
OUT ?= /app/assets/data/preflop_table.v1.json

gen-preflop:
	docker compose run --rm -v "$(CURDIR)/backend-rust/assets/data:/app/assets/data" app ./gen_preflop_table --out $(OUT) --trials $(TRIALS)
