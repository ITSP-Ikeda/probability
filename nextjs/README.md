# Texas Hold'em 勝率計算（モンテカルロ）— Next.js

Next.js フルスタック（API + UI）でテキサスホールデムの勝率をモンテカルロシミュレーションで計算します。

**ローカルに Node.js や npm をインストールする必要はありません。Docker だけでビルド・起動が完結します。**

## Docker で起動

```bash
docker compose up --build
```

（初回はイメージのビルドに数分かかることがあります。2回目以降は `docker compose up` で起動できます。）

起動後、ブラウザで **http://localhost:3010** にアクセスしてください。

## 停止

```bash
docker compose down
```

## API（curl 例）

```bash
curl -X POST http://localhost:3010/api/equity \
  -H "Content-Type: application/json" \
  -d '{"players":6,"hero":["As","Kd"],"board":["7h","8h","2c"],"preset":"standard","seed":12345}'
```

レスポンス例:

```json
{"win":0.3124,"tie":0.041,"lose":0.6466,"trials":200000,"elapsedMs":1234}
```

## UI 操作手順

1. 人数（2〜10）、自分の手札2枚、ボード（0/3/4/5枚）を入力
2. プリセットで試行回数を選択（高速 50k / 標準 200k / 高精度 1M）
3. 必要なら seed を指定（再現用）
4. 「計算」をクリック
5. Win/Tie/Lose %、試行回数、計算時間を確認

## プリフロップ固定表（任意）

- **board 0枚**のとき、169ハンドクラス×人数2〜10の固定表で即時に勝率を返します（表が生成済みの場合）。
- 固定表は **起動時には自動生成されません**。未生成の状態で board 0枚のリクエストを送ると、通常のモンテカルロ計算にフォールバックして結果を返します。
- 固定表の生成（手動）:
  ```bash
  make gen-preflop

  # 試行回数を変える場合
  make gen-preflop TRIALS=500000

  # 従来コマンド（同等）
  # ホストの ./data に出力し、コンテナの /app/data にマウントして利用
  docker compose run --rm -v $(pwd)/data:/app/data app npm run gen:preflop
  ```
  - デフォルトで 2,000,000 試行/ハンド。`--trials 500000` のように変更可能です。
  - 生成には時間がかかります（169×9 回のシミュレーション）。
- `docker compose up --build` では固定表が無くても起動でき、フロップ以降（board 3/4/5枚）は従来どおりモンテカルロで計算されます。

## 注意点

- 高精度（1M）は計算に数秒〜十数秒かかることがあります
- カード形式: `As`, `Kd`, `Td`（10はT）。スートは s,h,d,c
- 不正入力や重複カードは 400 エラーで理由を返します
