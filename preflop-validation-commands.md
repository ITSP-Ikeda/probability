# Preflop テーブル生成 検証コマンド集

このファイルは、3プロジェクト（`go-vue` / `nextjs` / `rust-react`）で同条件の検証を行うためのコマンド集です。

## 前提

- すべてリポジトリルート（このファイルと同じ階層）から実行
- 事前ビルド推奨（計測にビルド時間を混ぜない）
- 同時実行はせず、1プロジェクトずつ実行

```bash
cd /path/to/texas
docker compose -f go-vue/docker-compose.yml build
docker compose -f rust-react/docker-compose.yml build
docker compose -f nextjs/docker-compose.yml build
```

---

## 1) 動作確認用（軽量）: `trials=2000`

### go-vue

```bash
cd go-vue
/usr/bin/time -f "%e" docker compose run --rm app /app/texas-equity-api gen-preflop --out /app/assets/data/preflop_table.v1.json --trials 2000
cd ..
```

### nextjs

```bash
# 生成専用イメージ（初回のみ）
docker build -t nextjs-preflop-gen -f - ./nextjs <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps && npm install --no-save ts-node
COPY . .
CMD ["sh"]
EOF

/usr/bin/time -f "%e" docker run --rm \
  -v "$(pwd)/nextjs/data:/app/data" \
  nextjs-preflop-gen \
  npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/generate-preflop-table.ts --out /app/data/preflop_table.v1.json --trials 2000
```

### rust-react

```bash
cd rust-react
/usr/bin/time -f "%e" docker compose run --rm app ./gen_preflop_table --out /app/assets/data/preflop_table.v1.json --trials 2000
cd ..
```

---

## 2) 検証用（通常）: `trials=200000`

### go-vue

```bash
cd go-vue
/usr/bin/time -f "%e" docker compose run --rm app /app/texas-equity-api gen-preflop --out /app/assets/data/preflop_table.v1.json --trials 200000
cd ..
```

### nextjs

```bash
/usr/bin/time -f "%e" docker run --rm \
  -v "$(pwd)/nextjs/data:/app/data" \
  nextjs-preflop-gen \
  npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/generate-preflop-table.ts --out /app/data/preflop_table.v1.json --trials 200000
```

### rust-react

```bash
cd rust-react
/usr/bin/time -f "%e" docker compose run --rm app ./gen_preflop_table --out /app/assets/data/preflop_table.v1.json --trials 200000
cd ..
```

---

## 3) 厳密に全通り出力（exact enumeration）

`--mode exact` を追加済みです。  
※ 現時点の exact モードは計算量の都合で **players=2 限定**（`--players-min 2 --players-max 2`）です。

### go-vue

```bash
cd go-vue
/usr/bin/time -f "%e" docker compose run --rm app /app/texas-equity-api gen-preflop --mode exact --players-min 2 --players-max 2 --out /app/assets/data/preflop_table.v1.json
cd ..
```

### nextjs

```bash
/usr/bin/time -f "%e" docker run --rm \
  -v "$(pwd)/nextjs/data:/app/data" \
  nextjs-preflop-gen \
  npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/generate-preflop-table.ts --mode exact --players-min 2 --players-max 2 --out /app/data/preflop_table.v1.json
```

### rust-react

```bash
cd rust-react
/usr/bin/time -f "%e" docker compose run --rm app ./gen_preflop_table --mode exact --players-min 2 --players-max 2 --out /app/assets/data/preflop_table.v1.json
cd ..
```

