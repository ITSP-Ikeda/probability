.PHONY: gen-preflop

TRIALS ?= 2000000
OUT ?= /app/assets/data/preflop_table.v1.json

gen-preflop:
	docker compose run --rm -v "$(CURDIR)/backend-go/assets/data:/app/assets/data" app /app/texas-equity-api gen-preflop --out $(OUT) --trials $(TRIALS)
