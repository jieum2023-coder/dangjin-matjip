import { useMemo, useState } from 'react'
import { COMPANIONS, CUISINES, EUP_MYEON } from '../data'

const TABS = [
  { key: 'c', label: '음식종류' },
  { key: 'w', label: '식사상대' },
  { key: 'a', label: '지역' },
]

function Chip({ on, onClick, children, count }) {
  return (
    <button type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  )
}

export default function FilterPanel({ all, filters }) {
  const { f, toggle, update } = filters
  // 지도 보기에서는 지도가 잘 보이도록 패널을 접은 채로 시작한다. 같은 탭을 다시 누르면 접힌다.
  const [tab, setTab] = useState(f.view === 'map' ? null : 'c')

  const counts = useMemo(() => {
    const by = (key) => all.reduce((m, r) => ((m[r[key]] = (m[r[key]] ?? 0) + 1), m), {})
    return { cuisine: by('cuisine'), area: by('area'), region: by('region') }
  }, [all])

  const dongs = useMemo(
    () => Object.keys(counts.region)
      .filter((d) => d !== 'null' && all.some((r) => r.region === d && r.area === '시내'))
      .sort((a, b) => counts.region[b] - counts.region[a]),
    [all, counts],
  )

  const selected = { w: f.w.length, c: f.c.length, a: f.a.length + f.d.length }

  return (
    <section className="filters" aria-label="필터">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(tab === t.key ? null : t.key)}
          >
            {t.label}
            {selected[t.key] > 0 && <span className="badge">{selected[t.key]}</span>}
          </button>
        ))}
      </div>

      {tab && <div className="tab-panel" role="tabpanel">
        {tab === 'w' && (
          <>
            <div className="big-buttons">
              {COMPANIONS.filter((c) => c.big).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`big-btn${f.w.includes(c.key) ? ' on' : ''}`}
                  aria-pressed={f.w.includes(c.key)}
                  onClick={() => toggle('w', c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="chips">
              {COMPANIONS.filter((c) => !c.big).map((c) => (
                <Chip key={c.key} on={f.w.includes(c.key)} onClick={() => toggle('w', c.key)}>{c.label}</Chip>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={f.hint} onChange={(e) => update({ hint: e.target.checked })} />
              기사에 룸·놀이방 등이 언급된 곳도 함께 보기 (직접 확인 전)
            </label>
          </>
        )}

        {tab === 'c' && (
          <div className="chips">
            {CUISINES.map((c) => (
              <Chip key={c} on={f.c.includes(c)} onClick={() => toggle('c', c)} count={counts.cuisine[c] ?? 0}>
                {c === '식당외' ? '식당외(먹거리 가게)' : c}
              </Chip>
            ))}
          </div>
        )}

        {tab === 'a' && (
          <>
            <div className="chips">
              <Chip on={f.a.includes('시내')} onClick={() => {
                // 시내를 끄면 그 안의 동 선택도 함께 지운다
                if (f.a.includes('시내')) update({ a: f.a.filter((x) => x !== '시내'), d: [] })
                else toggle('a', '시내')
              }} count={counts.area['시내'] ?? 0}>시내(동 지역)</Chip>
              {EUP_MYEON.filter((a) => counts.area[a]).map((a) => (
                <Chip key={a} on={f.a.includes(a)} onClick={() => toggle('a', a)} count={counts.area[a]}>{a}</Chip>
              ))}
            </div>
            {f.a.includes('시내') && (
              <>
                <p className="sub-label">시내에서 동 고르기 (안 고르면 시내 전체)</p>
                <div className="chips">
                  {dongs.map((d) => (
                    <Chip key={d} on={f.d.includes(d)} onClick={() => toggle('d', d)} count={counts.region[d]}>{d}</Chip>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>}
    </section>
  )
}
