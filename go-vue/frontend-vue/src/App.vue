<script setup lang="ts">
import { ref, watch } from 'vue'

const RANKS = 'AKQJT98765432'
const SUITS = 'shdc'
const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

function getAllCards(): string[] {
  return RANKS.split('').flatMap((r) => SUITS.split('').map((s) => r + s))
}

function getTwoUnusedCards(used: string[]): [string, string] {
  const set = new Set(used)
  const available = getAllCards().filter((c) => !set.has(c))
  return [available[0], available[1]]
}

function codeToObj(code: string): CardChoice {
  return { rank: code[0], suit: code[1] }
}

type Preset = 'fast' | 'standard' | 'high'
type BoardCount = 0 | 3 | 4 | 5

interface Result {
  win: number
  tie: number
  lose: number
  trials: number
  elapsedMs: number
  method?: 'preflop_table' | 'monte_carlo'
  note?: string
}

interface CardChoice {
  rank: string
  suit: string
}

function isRedSuit(suit: string): boolean {
  return suit === 'h' || suit === 'd'
}

function validateClient(hero: string[], board: string[]): string | null {
  if (hero.length !== 2) return '手札は2枚選択してください'
  const allowed = [0, 3, 4, 5]
  if (!allowed.includes(board.length)) return 'ボードは0/3/4/5枚で選択してください'
  const all = [...hero, ...board]
  const set = new Set(all)
  if (set.size !== all.length) return '同じカードが重複しています'
  return null
}

const players = ref(6)
const heroCards = ref<CardChoice[]>([
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 'd' },
])
const boardCount = ref<BoardCount>(3)
const initialBoard = ((): CardChoice[] => {
  const [c3, c4] = getTwoUnusedCards(['As', 'Kd', '7h', '8h', '2c'])
  return [
    { rank: '7', suit: 'h' },
    { rank: '8', suit: 'h' },
    { rank: '2', suit: 'c' },
    codeToObj(c3),
    codeToObj(c4),
  ]
})()
const boardCards = ref<CardChoice[]>(initialBoard)
const preset = ref<Preset>('standard')

watch(
  () => [
    heroCards.value[0]?.rank,
    heroCards.value[0]?.suit,
    heroCards.value[1]?.rank,
    heroCards.value[1]?.suit,
    boardCards.value[0]?.rank,
    boardCards.value[0]?.suit,
    boardCards.value[1]?.rank,
    boardCards.value[1]?.suit,
    boardCards.value[2]?.rank,
    boardCards.value[2]?.suit,
  ],
  () => {
    const used = [
      ...heroCards.value.map((c) => c.rank + c.suit),
      ...boardCards.value.slice(0, 3).map((c) => c.rank + c.suit),
    ]
    const [c3, c4] = getTwoUnusedCards(used)
    const cur3 = boardCards.value[3].rank + boardCards.value[3].suit
    const cur4 = boardCards.value[4].rank + boardCards.value[4].suit
    if (cur3 === c3 && cur4 === c4) return
    const next = [...boardCards.value]
    next[3] = codeToObj(c3)
    next[4] = codeToObj(c4)
    boardCards.value = next
  },
  { deep: true }
)
const loading = ref(false)
const result = ref<Result | null>(null)
const error = ref<string | null>(null)

function setHeroCard(i: number, field: 'rank' | 'suit', value: string) {
  const next = [...heroCards.value]
  next[i] = { ...next[i], [field]: value }
  heroCards.value = next
}

function setBoardCard(i: number, field: 'rank' | 'suit', value: string) {
  const next = [...boardCards.value]
  next[i] = { ...next[i], [field]: value }
  boardCards.value = next
}

function buildHero(): string[] {
  return heroCards.value.map((c) => c.rank + c.suit)
}

function buildBoard(): string[] {
  return boardCards.value.slice(0, boardCount.value).map((c) => c.rank + c.suit)
}

async function handleSubmit() {
  error.value = null
  result.value = null
  const hero = buildHero()
  const board = buildBoard()
  const err = validateClient(hero, board)
  if (err) {
    error.value = err
    return
  }
  loading.value = true
  const body: Record<string, unknown> = {
    players: players.value,
    hero,
    board,
    preset: preset.value,
  }
  try {
    const res = await fetch('/api/equity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      error.value = data.details || data.error || `Error ${res.status}`
      return
    }
    result.value = data as Result
  } catch (err) {
    error.value = String(err)
  } finally {
    loading.value = false
  }
}

const sectionStyle = 'margin-top: 1.5rem; margin-bottom: 0.5rem'
const labelBlock = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem'
const labelBlockObj = { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }
const cardBlock = 'display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.35rem 0.5rem; border: 1px solid #ddd; border-radius: 6px; background: #fafafa; flex: 0 0 auto; white-space: nowrap'
const selectStyle = { fontSize: '1.1rem', padding: '0.35rem 0.5rem', minHeight: '2.25rem' }
const handRow = { display: 'flex', flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: '0.35rem', alignItems: 'center' }
const boardRow = { display: 'flex', flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: '0.35rem', alignItems: 'center' }
</script>

<template>
  <main style="max-width: 100%; overflow-x: hidden; box-sizing: border-box">
    <h1 style="display: flex; flex-wrap: wrap; gap: 0.25em; margin: 0">
      <span>Texas Hold'em 勝率計算</span>
      <span>（モンテカルロ）</span>
    </h1>

    <form @submit.prevent="handleSubmit" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem">
      <label :style="{ ...labelBlockObj, fontSize: '1.25rem' }">
        人数 (2–10):
        <input v-model.number="players" type="number" min="2" max="10" style="font-size: 1.25rem" />
      </label>

      <h2 :style="sectionStyle">自分の手札 (2枚)</h2>
      <div :style="handRow">
        <div v-for="(card, i) in heroCards" :key="i" :style="cardBlock">
          <select
            :value="card.suit"
            @change="setHeroCard(i, 'suit', ($event.target as HTMLSelectElement).value)"
            :aria-label="`手札${i + 1} スート`"
            :style="selectStyle"
          >
            <option v-for="s in SUITS" :key="s" :value="s">{{ SUIT_SYMBOLS[s] }}</option>
          </select>
          <select
            :value="card.rank"
            @change="setHeroCard(i, 'rank', ($event.target as HTMLSelectElement).value)"
            :aria-label="`手札${i + 1} ランク`"
            :style="selectStyle"
          >
            <option v-for="r in RANKS" :key="r" :value="r">{{ r }}</option>
          </select>
          <span style="font-weight: 600; white-space: nowrap">
            <template v-if="card.rank && card.suit"><span :style="isRedSuit(card.suit) ? { color: '#c00' } : {}">{{ SUIT_SYMBOLS[card.suit] }}</span>{{ card.rank }}</template>
            <template v-else>—</template>
          </span>
        </div>
      </div>

      <h2 :style="sectionStyle">ボード (0/3/4/5枚)</h2>
      <label :style="labelBlock">
        ボードの枚数:
        <select v-model.number="boardCount" :style="selectStyle">
          <option :value="0">0枚</option>
          <option :value="3">3枚</option>
          <option :value="4">4枚</option>
          <option :value="5">5枚</option>
        </select>
      </label>
      <div v-if="boardCount > 0" style="display: flex; flex-direction: column; gap: 0.35rem">
        <div :style="boardRow">
          <div v-for="i in Math.min(3, boardCount)" :key="i - 1" :style="cardBlock">
            <select
              :value="boardCards[i - 1].suit"
              @change="setBoardCard(i - 1, 'suit', ($event.target as HTMLSelectElement).value)"
              :aria-label="`ボード${i} スート`"
              :style="selectStyle"
            >
              <option v-for="s in SUITS" :key="s" :value="s">{{ SUIT_SYMBOLS[s] }}</option>
            </select>
            <select
              :value="boardCards[i - 1].rank"
              @change="setBoardCard(i - 1, 'rank', ($event.target as HTMLSelectElement).value)"
              :aria-label="`ボード${i} ランク`"
              :style="selectStyle"
            >
              <option v-for="r in RANKS" :key="r" :value="r">{{ r }}</option>
            </select>
            <span style="font-weight: 600; white-space: nowrap">
              <template v-if="boardCards[i - 1].rank && boardCards[i - 1].suit"><span :style="isRedSuit(boardCards[i - 1].suit) ? { color: '#c00' } : {}">{{ SUIT_SYMBOLS[boardCards[i - 1].suit] }}</span>{{ boardCards[i - 1].rank }}</template>
              <template v-else>—</template>
            </span>
          </div>
        </div>
        <div v-if="boardCount >= 4" :style="boardRow">
          <div v-for="(card, idx) in boardCards.slice(3, boardCount)" :key="idx + 3" :style="cardBlock">
            <select
              :value="card.suit"
              @change="setBoardCard(idx + 3, 'suit', ($event.target as HTMLSelectElement).value)"
              :aria-label="`ボード${idx + 4} スート`"
              :style="selectStyle"
            >
              <option v-for="s in SUITS" :key="s" :value="s">{{ SUIT_SYMBOLS[s] }}</option>
            </select>
            <select
              :value="card.rank"
              @change="setBoardCard(idx + 3, 'rank', ($event.target as HTMLSelectElement).value)"
              :aria-label="`ボード${idx + 4} ランク`"
              :style="selectStyle"
            >
              <option v-for="r in RANKS" :key="r" :value="r">{{ r }}</option>
            </select>
            <span style="font-weight: 600; white-space: nowrap">
              <template v-if="card.rank && card.suit"><span :style="isRedSuit(card.suit) ? { color: '#c00' } : {}">{{ SUIT_SYMBOLS[card.suit] }}</span>{{ card.rank }}</template>
              <template v-else>—</template>
            </span>
          </div>
        </div>
      </div>

      <h2 :style="sectionStyle">検証件数</h2>
      <label :style="labelBlock">
        <select v-model="preset" :style="selectStyle" aria-label="検証件数">
          <option value="fast">高速（50,000通り）</option>
          <option value="standard">標準（200,000通り）</option>
          <option value="high">高精度（1,000,000通り）</option>
        </select>
      </label>
      <button type="submit" :disabled="loading" style="margin-top: 0.5rem; padding: 0.5rem 1rem; align-self: flex-start">
        {{ loading ? '計算中…' : '計算' }}
      </button>
    </form>

    <div v-if="error" style="margin-top: 1rem; padding: 0.75rem; background: #fee; color: #c00; border-radius: 6px">
      {{ error }}
    </div>

    <div v-if="result" style="margin-top: 1.5rem; padding: 1.25rem; background: #f0f8f0; border-radius: 8px; border: 1px solid #c8e6c9">
      <h2 style="margin-top: 0; margin-bottom: 0.75rem; font-size: 1.1rem">結果</h2>
      <p v-if="result.method === 'preflop_table'" style="margin-bottom: 0.5rem; color: #2e7d32; font-size: 0.9rem; font-weight: 600">
        プリフロップ固定表を使用
      </p>
      <p style="font-size: 1.25rem; font-weight: 700; margin: 0.25rem 0">
        Win: {{ (result.win * 100).toFixed(2) }}%
      </p>
      <p style="font-size: 1.25rem; font-weight: 700; margin: 0.25rem 0">
        Tie: {{ (result.tie * 100).toFixed(2) }}%
      </p>
      <p style="font-size: 1.25rem; font-weight: 700; margin: 0.25rem 0">
        Lose: {{ (result.lose * 100).toFixed(2) }}%
      </p>
      <p style="margin-top: 0.75rem; color: #555; font-size: 0.9rem">
        試行回数: {{ result.trials.toLocaleString() }} / 計算時間: {{ result.elapsedMs }} ms
      </p>
      <p v-if="result.note" style="margin-top: 0.5rem; color: #666; font-size: 0.85rem">{{ result.note }}</p>
    </div>
  </main>
</template>
