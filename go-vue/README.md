# Texas Hold'em 勝率計算 — Go + Vue

Go(Echo) API と Vite+Vue3 フロントを単一コンテナで提供します。

**ローカルに Go や Node.js をインストールする必要はありません。Docker だけでビルド・起動が完結します。**

## 起動

```bash
docker compose up --build
```

起動後、**http://localhost:3012** にアクセスしてください。

## 停止

```bash
docker compose down
```

## API（curl 例）

```bash
curl -X POST http://localhost:3012/api/equity \
  -H "Content-Type: application/json" \
  -d '{"players":6,"hero":["As","Kd"],"board":["7h","8h","2c"],"preset":"standard","seed":12345}'
```

## プリフロップ固定表（任意）

- **ボード0枚**のとき、169ハンドクラス×人数2〜10の固定表で即時に勝率を返します（表が生成済みの場合）。
- 固定表は **起動時には自動生成されません**。未生成の状態でボード0枚のリクエストを送ると **400** で `preflop table not generated` を返します（フォールバックのモンテカルロは行いません）。
- 固定表の生成（手動）:
  ```bash
  docker compose run --rm -v $(pwd)/backend-go/assets/data:/app/assets/data app /app/texas-equity-api gen-preflop --out /app/assets/data/preflop_table.v1.json --trials 2000000
  ```
  生成後、通常起動時に同じディレクトリをマウントすると固定表が読み込まれます（compose に volumes を追加）。
- `docker compose up --build` では固定表が無くても起動できます。

## UI 操作・注意点

人数・手札2枚・ボード(0/3/4/5枚)・プリセット・seed(任意)を入力し「計算」をクリック。高精度(1M)は時間がかかることがあります。カード形式: As, Kd, Td（10はT）。スートは s,h,d,c。
