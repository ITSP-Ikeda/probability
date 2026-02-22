import { useState, useEffect } from 'react'

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

function codeToObj(code: string): { rank: string; suit: string } {
  return { rank: code[0], suit: code[1] }
}

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
  const [boardCards, setBoardCards] = useState<{ rank: string; suit: string }[]>(() => {
    const b0 = { rank: '7', suit: 'h' }
    const b1 = { rank: '8', suit: 'h' }
    const b2 = { rank: '2', suit: 'c' }
    const used = ['As', 'Kd', '7h', '8h', '2c']
    const [c3, c4] = getTwoUnusedCards(used)
    return [b0, b1, b2, codeToObj(c3), codeToObj(c4)]
  })
  const [preset, setPreset] = useState<Preset>('standard')

  useEffect(() => {
    const used = [
      ...heroCards.map((c) => c.rank + c.suit),
      ...boardCards.slice(0, 3).map((c) => c.rank + c.suit),
    ]
    const [c3, c4] = getTwoUnusedCards(used)
    setBoardCards((prev) => {
      const cur3 = prev[3].rank + prev[3].suit
      const cur4 = prev[4].rank + prev[4].suit
      if (cur3 === c3 && cur4 === c4) return prev
      const next = [...prev]
      next[3] = codeToObj(c3)
      next[4] = codeToObj(c4)
      return next
    })
  }, [
    heroCards[0]?.rank,
    heroCards[0]?.suit,
    heroCards[1]?.rank,
    heroCards[1]?.suit,
    boardCards[0]?.rank,
    boardCards[0]?.suit,
    boardCards[1]?.rank,
    boardCards[1]?.suit,
    boardCards[2]?.rank,
    boardCards[2]?.suit,
  ])
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
  const handRow = { display: 'flex', flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: '0.35rem', alignItems: 'center' }
  const boardRow = { display: 'flex', flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: '0.35rem', alignItems: 'center' }
  const cardBlock = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.35rem 0.5rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    background: '#fafafa',
    flex: '0 0 auto',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <main style={{ maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <h1 style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em', margin: 0 }}>
        <span>Texas Hold&apos;em 勝率計算</span>
        <span>（モンテカルロ）</span>
      </h1>

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
                value={heroCards[i]?.suit ?? ''}
                onChange={(e) => setHeroCard(i, 'suit', e.target.value)}
                aria-label={`手札${i + 1} スート`}
                style={selectStyle}
              >
                {SUITS.split('').map((s) => (
                  <option key={s} value={s}>{SUIT_SYMBOLS[s]}</option>
                ))}
              </select>
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
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {heroCards[i]?.rank && heroCards[i]?.suit ? (
                  <><span style={isRedSuit(heroCards[i].suit) ? { color: '#c00' } : {}}>{SUIT_SYMBOLS[heroCards[i].suit]}</span>{heroCards[i].rank}</>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={boardRow}>
              {Array.from({ length: Math.min(3, boardCount) }, (_, i) => (
                <div key={i} style={cardBlock}>
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
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {boardCards[i]?.rank && boardCards[i]?.suit ? (
                      <><span style={isRedSuit(boardCards[i].suit) ? { color: '#c00' } : {}}>{SUIT_SYMBOLS[boardCards[i].suit]}</span>{boardCards[i].rank}</>
                    ) : '—'}
                  </span>
                </div>
              ))}
            </div>
            {boardCount >= 4 && (
              <div style={boardRow}>
                {Array.from({ length: boardCount - 3 }, (_, j) => {
                  const i = j + 3
                  return (
                    <div key={i} style={cardBlock}>
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
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {boardCards[i]?.rank && boardCards[i]?.suit ? (
                          <><span style={isRedSuit(boardCards[i].suit) ? { color: '#c00' } : {}}>{SUIT_SYMBOLS[boardCards[i].suit]}</span>{boardCards[i].rank}</>
                        ) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <h2 style={sectionStyle}>検証件数</h2>
        <label style={labelBlock}>
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} style={selectStyle} aria-label="検証件数">
            <option value="fast">高速（50,000通り）</option>
            <option value="standard">標準（200,000通り）</option>
            <option value="high">高精度（1,000,000通り）</option>
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
