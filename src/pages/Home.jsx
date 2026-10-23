import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { applyFilters, COMPANIONS, useRestaurants } from '../data'
import { useFilters } from '../filters'
import FilterPanel from '../components/FilterPanel'
import RandomPick from '../components/RandomPick'
import RestaurantCard from '../components/RestaurantCard'
import Footer from '../components/Footer'
import MapView from '../components/MapView'

const PAGE = 40

export default function Home() {
  const { data, error } = useRestaurants()
  const filters = useFilters()
  const { f, update, toggle, reset, count } = filters
  const { search } = useLocation()
  const [limit, setLimit] = useState(PAGE)

  const list = useMemo(() => {
    if (!data) return []
    return applyFilters(data, f).sort((a, b) => (b.article.date ?? '').localeCompare(a.article.date ?? ''))
  }, [data, f.c.join(), f.w.join(), f.a.join(), f.d.join(), f.q, f.hint])

  if (error) return <p className="status">식당 목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
  if (!data) return <p className="status">불러오는 중…</p>

  const chips = [
    ...f.w.map((k) => ['w', k, COMPANIONS.find((c) => c.key === k)?.label ?? k]),
    ...f.c.map((k) => ['c', k, k]),
    ...f.a.map((k) => ['a', k, k === '시내' ? '시내' : k]),
    ...f.d.map((k) => ['d', k, k]),
  ]
  const onlyCompanion = f.w.length > 0 && list.length === 0

  return (
    <>
      <header className="header">
        <h1>당진 맛집</h1>
        <input
          type="search"
          className="search"
          placeholder="가게 이름·메뉴로 찾기"
          value={f.q}
          onChange={(e) => update({ q: e.target.value })}
        />
      </header>

      <FilterPanel all={data} filters={filters} />

      {chips.length > 0 && (
        <div className="selected">
          {chips.map(([key, value, label]) => (
            <button key={key + value} type="button" className="chip on small" onClick={() => toggle(key, value)}>
              {label} ✕
            </button>
          ))}
          <button type="button" className="link-btn" onClick={reset}>전체 해제</button>
        </div>
      )}

      <div className="toolbar">
        <div className="view-toggle" role="group" aria-label="보기 방식">
          <button type="button" className={f.view === 'list' ? 'on' : ''} onClick={() => update({ view: 'list' })}>목록</button>
          <button type="button" className={f.view === 'map' ? 'on' : ''} onClick={() => update({ view: 'map' })}>지도</button>
        </div>
        <span className="result-count">{list.length}곳{count === 0 && ' (식당외 제외)'}</span>
      </div>

      <RandomPick list={list} search={search} />

      {f.view === 'map' ? (
        <MapView list={list} search={search} />
      ) : list.length === 0 ? (
        <div className="status">
          <p>조건에 맞는 곳이 아직 없어요.</p>
          {onlyCompanion && (
            <p className="muted">
              룸·아기의자·놀이방 같은 정보는 방문해서 확인한 뒤 관리 화면에서 채워 넣으면 여기에 나타나요.
              {!f.hint && ' 위의 "기사에 언급된 곳도 함께 보기"를 켜면 후보를 볼 수 있어요.'}
            </p>
          )}
        </div>
      ) : (
        <>
          <ul className="list">
            {list.slice(0, limit).map((r) => <RestaurantCard key={r.id} r={r} search={search} />)}
          </ul>
          {limit < list.length && (
            <button type="button" className="btn more" onClick={() => setLimit(limit + PAGE)}>
              더 보기 ({list.length - limit}곳 남음)
            </button>
          )}
        </>
      )}
      <Footer />
    </>
  )
}
