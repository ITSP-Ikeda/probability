import { useState } from 'react'

const RANKS = 'AKQJT98765432'
const SUITS = 'shdc'
const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

type Preset = 'fast' | 'standard' | 'high'
type BoardCount = 0 | 3 | 4 | 5

interface Result {
  win: number
  tie: number
  lose: number
  trials: number
  elapsedMs?: number
  elapsed_ms?: number
  method?: 'preflop_table' | 'monte_carlo'
  note?: string
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

export default function App() {
  const [players, setPlayers] = useState(6)
  const [heroCards, setHeroCards] = useState<{ rank: string; suit: string }[]>([
    { rank: 'A', suit: 's' },
    { rank: 'K', suit: 'd' },
  ])
  const [boardCount, setBoardCount] = useState<BoardCount>(3)
  const [boardCards, setBoardCards] = useState<{ rank: string; suit: string }[]>([
    { rank: '7', suit: 'h' },
    { rank: '8', suit: 'h' },
    { rank: '2', suit: 'c' },
    { rank: '2', suit: 'c' },
    { rank: '2', suit: 'c' },
  ])
  const [preset, setPreset] = useState<Preset>('standard')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setHeroCard(i: number, field: 'rank' | 'suit', value: string) {
    setHeroCards((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  function setBoardCard(i: number, field: 'rank' | 'suit', value: string) {
    setBoardCards((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  function buildHero(): string[] {
    return heroCards.map((c) => c.rank + c.suit)
  }

  function buildBoard(): string[] {
    return boardCards.slice(0, boardCount).map((c) => c.rank + c.suit)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    const hero = buildHero()
    const board = buildBoard()
    const err = validateClient(hero, board)
    if (err) {
      setError(err)
      return
    }
    setLoading(true)
    const body: Record<string, unknown> = {
      players,
      hero,
      board,
      preset,
    }
    try {
      const res = await fetch('/api/equity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError((data as { details?: string; error?: string }).details || (data as { error?: string }).error || `Error ${res.status}`)
        return
      }
      setResult(data as Result)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const sectionStyle = { marginTop: '1.5rem', marginBottom: '0.5rem' }
  const labelBlock = { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' } as const
  const selectStyle = { fontSize: '1.1rem', padding: '0.35rem 0.5rem', minHeight: '2.25rem' } as const
  const handRow = { display: 'flex', flexDirection: 'row' as const, flexWrap: 'nowrap' as const, gap: '0.35rem', alignItems: 'center' }
  const boardRow = { display: 'flex', flexDirection: 'row' as const, flexWrap: 'nowrap' as const, gap: '0.35rem', alignItems: 'center' }
  const cardBlock = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.35rem 0.5rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    background: '#fafafa',
    flex: '0 0 auto',
  }

  return (
    <main>
      <h1>Texas Hold&apos;em 勝率計算（モンテカルロ）</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        <label style={{ ...labelBlock, fontSize: '1.25rem' }}>
          人数 (2–10):{' '}
          <input
            type="number"
            min={2}
            max={10}
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
            style={{ fontSize: '1.25rem' }}
          />
        </label>

        <h2 style={sectionStyle}>自分の手札 (2枚)</h2>
        <div style={handRow}>
          {[0, 1].map((i) => (
            <div key={i} style={cardBlock}>
              <select
                value={heroCards[i]?.rank ?? ''}
                onChange={(e) => setHeroCard(i, 'rank', e.target.value)}
                aria-label={`手札${i + 1} ランク`}
                style={selectStyle}
              >
                {RANKS.split('').map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={heroCards[i]?.suit ?? ''}
                onChange={(e) => setHeroCard(i, 'suit', e.target.value)}
                aria-label={`手札${i + 1} スート`}
                style={selectStyle}
              >
                {SUITS.split('').map((s) => (
                  <option key={s} value={s}>{SUIT_SYMBOLS[s]}</option>
                ))}
              </select>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {heroCards[i]?.rank && heroCards[i]?.suit ? (
                  <>{heroCards[i].rank}<span style={isRedSuit(heroCards[i].suit) ? { color: '#c00' } : {}}>{SUIT_SYMBOLS[heroCards[i].suit]}</span></>
                ) : '—'}
              </span>
            </div>
          ))}
        </div>

        <h2 style={sectionStyle}>ボード (0/3/4/5枚)</h2>
        <label style={labelBlock}>
          ボードの枚数:{' '}
          <select
            value={boardCount}
            onChange={(e) => setBoardCount(Number(e.target.value) as BoardCount)}
            style={selectStyle}
          >
            <option value={0}>0枚</option>
            <option value={3}>3枚</option>
            <option value={4}>4枚</option>
            <option value={5}>5枚</option>
          </select>
        </label>
        {boardCount > 0 && (
          <div style={boardRow}>
            {Array.from({ length: boardCount }, (_, i) => (
              <div key={i} style={cardBlock}>
                <select
                  value={boardCards[i]?.rank ?? ''}
                  onChange={(e) => setBoardCard(i, 'rank', e.target.value)}
                  aria-label={`ボード${i + 1} ランク`}
                  style={selectStyle}
                >
                  {RANKS.split('').map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  value={boardCards[i]?.suit ?? ''}
                  onChange={(e) => setBoardCard(i, 'suit', e.target.value)}
                  aria-label={`ボード${i + 1} スート`}
                  style={selectStyle}
                >
                  {SUITS.split('').map((s) => (
                    <option key={s} value={s}>{SUIT_SYMBOLS[s]}</option>
                  ))}
                </select>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {boardCards[i]?.rank && boardCards[i]?.suit ? (
                    <>{boardCards[i].rank}<span style={isRedSuit(boardCards[i].suit) ? { color: '#c00' } : {}}>{SUIT_SYMBOLS[boardCards[i].suit]}</span></>
                  ) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <h2 style={sectionStyle}>計算オプション</h2>
        <label style={labelBlock}>
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} style={selectStyle} aria-label="プリセット">
            <option value="fast">高速 (50k)</option>
            <option value="standard">標準 (200k)</option>
            <option value="high">高精度 (1M)</option>
          </select>
        </label>
        <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', alignSelf: 'flex-start' }}>
          {loading ? '計算中…' : '計算'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fee', color: '#c00', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f0f8f0', borderRadius: '8px', border: '1px solid #c8e6c9' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.1rem' }}>結果</h2>
          {result.method === 'preflop_table' && (
            <p style={{ marginBottom: '0.5rem', color: '#2e7d32', fontSize: '0.9rem', fontWeight: 600 }}>
              プリフロップ固定表を使用
            </p>
          )}
          <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0' }}>
            Win: {(result.win * 100).toFixed(2)}%
          </p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0' }}>
            Tie: {(result.tie * 100).toFixed(2)}%
          </p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0' }}>
            Lose: {(result.lose * 100).toFixed(2)}%
          </p>
          <p style={{ marginTop: '0.75rem', color: '#555', fontSize: '0.9rem' }}>
            試行回数: {result.trials.toLocaleString()} / 計算時間: {(result.elapsedMs ?? result.elapsed_ms ?? 0)} ms
          </p>
          {result.note && (
            <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.85rem' }}>{result.note}</p>
          )}
        </div>
      )}
    </main>
  )
}
