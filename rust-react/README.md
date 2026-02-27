# Texas Hold'em 勝率計算 — Rust + React

Rust(axum) API と Vite+React フロントを単一コンテナで提供します。

**ローカルに Node.js や Rust をインストールする必要はありません。Docker だけでビルド・起動が完結します。**

## 起動

```bash
docker compose up --build
```

起動後、**http://localhost:3011** にアクセスしてください。

## 停止

```bash
docker compose down
```

## API（curl 例）

```bash
curl -X POST http://localhost:3011/api/equity \
  -H "Content-Type: application/json" \
  -d '{"players":6,"hero":["As","Kd"],"board":["7h","8h","2c"],"preset":"standard","seed":12345}'
```

## UI 操作

人数・手札2枚・ボード(0/3/4/5枚)・プリセット・seed(任意)を入力し「計算」をクリック。Win/Tie/Lose % と試行回数・計算時間を表示します。

## プリフロップ固定表（任意）

- **ボード0枚**のとき、169ハンドクラス×人数2〜10の固定表で即時に勝率を返します（表が生成済みの場合）。
- 固定表は **起動時には自動生成されません**。未生成の状態でボード0枚のリクエストを送ると、通常のモンテカルロ計算にフォールバックして結果を返します。
- 固定表の生成（手動）:
  ```bash
  make gen-preflop

  # 試行回数を変える場合
  make gen-preflop TRIALS=500000

  # 従来コマンド（同等）
  # ホストの backend-rust/assets/data に出力して利用（ボリュームでマウント）
  docker compose run --rm -v $(pwd)/backend-rust/assets/data:/app/assets/data app ./gen_preflop_table --out /app/assets/data/preflop_table.v1.json --trials 2000000
  ```
  生成後、通常起動時に同じディレクトリをマウントすると固定表が読み込まれます:
  ```yaml
  volumes:
    - ./backend-rust/assets/data:/app/assets/data
  ```
- `docker compose up --build` では固定表が無くても起動できます。

## 注意点

- 高精度(1M)は計算に時間がかかることがあります。
- カード形式: As, Kd, Td（10はT）。スートは s,h,d,c。
