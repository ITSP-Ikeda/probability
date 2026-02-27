.PHONY: gen-preflop

TRIALS ?= 2000000
OUT ?= /app/data/preflop_table.v1.json

gen-preflop:
	docker compose run --rm -v "$(CURDIR)/data:/app/data" app npm run gen:preflop -- --out $(OUT) --trials $(TRIALS)
