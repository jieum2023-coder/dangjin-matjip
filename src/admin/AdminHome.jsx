import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { updateCache, useRestaurants } from '../data'
import { AuthError, geocodeBatch, getToken, login, logout } from './api'

function Login({ onDone }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(pw)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="admin-login" onSubmit={submit}>
      <h1>관리 화면</h1>
      <label htmlFor="pw">비밀번호</label>
      <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn primary" disabled={busy || !pw}>{busy ? '확인 중…' : '들어가기'}</button>
      <Link to="/" className="back">← 앱으로 돌아가기</Link>
    </form>
  )
}

/** 좌표가 없는 가게를 카카오 주소 검색으로 채운다. 한 번 요청에 100곳씩, 남은 곳이 없을 때까지 되풀이 */
function GeocodePanel({ data, onAuthError }) {
  const [state, setState] = useState(null)
  const missing = data.filter((r) => r.lat == null && /\d/.test(r.address ?? '') && r.geoTried !== r.address).length

  const run = async () => {
    setState({ busy: true, text: '좌표를 찾는 중…' })
    let found = 0
    let failed = 0
    try {
      for (;;) {
        const res = await geocodeBatch()
        found += res.found
        failed += res.failed
        setState({ busy: true, text: `찾음 ${found}곳 · 못 찾음 ${failed}곳 · 남은 곳 ${res.remaining}곳` })
        if (res.remaining === 0 || res.found + res.failed === 0) {
          const all = await (await fetch('/api/restaurants', { cache: 'no-store' })).json()
          updateCache(() => all)
          setState({ text: `끝났어요. 찾음 ${found}곳 · 못 찾음 ${failed}곳 (지도에 표시되는 곳 ${res.withCoords}/${res.total})` })
          return
        }
      }
    } catch (e) {
      if (e instanceof AuthError) onAuthError()
      setState({ error: true, text: `${e.message} (찾음 ${found}곳까지는 저장됐어요)` })
    }
  }

  return (
    <section className="panel">
      <h2>지도 좌표 채우기</h2>
      <p className="muted small">
        좌표가 없는 곳 {missing}곳. 주소로 위치를 찾아 저장하면 지도에 바로 표시돼요.
        못 찾은 곳은 주소를 고친 뒤 다시 누르면 다시 찾아요.
      </p>
      {state && <p className={state.error ? 'error' : 'ok'} role="status">{state.text}</p>}
      <button type="button" className="btn wide" onClick={run} disabled={state?.busy || missing === 0}>
        {state?.busy ? '찾는 중… (창을 닫지 마세요)' : missing === 0 ? '모두 채워졌어요' : '좌표 채우기'}
      </button>
    </section>
  )
}

const SORTS = {
  old: { label: '오래된 기사순', fn: (a, b) => (a.article.date ?? '').localeCompare(b.article.date ?? '') },
  new: { label: '최근 기사순', fn: (a, b) => (b.article.date ?? '').localeCompare(a.article.date ?? '') },
  checked: { label: '최근 확인순', fn: (a, b) => (b.lastChecked ?? '').localeCompare(a.lastChecked ?? '') },
}

export default function AdminHome() {
  const [authed, setAuthed] = useState(!!getToken())
  const { data, error } = useRestaurants()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('old')
  const [onlyUnchecked, setOnlyUnchecked] = useState(false)
  const navigate = useNavigate()

  const list = useMemo(() => {
    if (!data) return []
    const s = q.trim()
    return data
      .filter((r) => !onlyUnchecked || !r.lastChecked)
      .filter((r) => !s || `${r.name ?? ''} ${r.address ?? ''} ${r.region ?? ''}`.includes(s))
      .sort(SORTS[sort].fn)
  }, [data, q, sort, onlyUnchecked])

  if (!authed) return <Login onDone={() => setAuthed(true)} />
  if (error) return <p className="status">데이터를 불러오지 못했어요.</p>
  if (!data) return <p className="status">불러오는 중…</p>

  const checked = data.filter((r) => r.lastChecked).length

  return (
    <div className="admin">
      <header className="header admin-header">
        <h1>관리</h1>
        <button type="button" className="link-btn" onClick={() => { logout(); setAuthed(false) }}>로그아웃</button>
      </header>
      <p className="muted">전체 {data.length}곳 · 방문 확인 {checked}곳</p>
      <button type="button" className="btn primary wide" onClick={() => navigate('/admin/new')}>+ 새 가게 추가</button>
      <GeocodePanel data={data} onAuthError={() => setAuthed(false)} />
      <input type="search" className="search wide" placeholder="상호·주소·동으로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {Object.entries(SORTS).map(([k, v]) => (
          <button key={k} type="button" className={`chip${sort === k ? ' on' : ''}`} onClick={() => setSort(k)}>{v.label}</button>
        ))}
        <button type="button" className={`chip${onlyUnchecked ? ' on' : ''}`} onClick={() => setOnlyUnchecked(!onlyUnchecked)}>
          확인 안 한 곳만
        </button>
      </div>
      <p className="result-count">{list.length}곳</p>
      <ul className="admin-list">
        {list.slice(0, 200).map((r) => (
          <li key={r.id}>
            <Link to={`/admin/r/${r.id}`}>
              <span className="name">{r.name ?? '(상호 확인 중)'}{r.closed === true && <span className="pill warn">폐업</span>}</span>
              <span className="muted small">
                {r.cuisine} · {r.region ?? '지역 확인 중'} · {r.article.date?.slice(0, 4) ?? '-'}년 기사
                {r.lastChecked ? ` · 확인 ${r.lastChecked}` : ' · 미확인'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length > 200 && <p className="muted">앞의 200곳만 보여요. 검색으로 좁혀 주세요.</p>}
    </div>
  )
}
