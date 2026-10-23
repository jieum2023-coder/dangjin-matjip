import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { COMPANIONS, CUISINES, EUP_MYEON, updateCache, useRestaurants } from '../data'
import { AuthError, createRestaurant, deleteRestaurant, getToken, updateRestaurant } from './api'

const PRICE_RANGES = ['1만원 미만', '1~2만원', '2~3만원', '3만원 이상']
const SEATING = ['좌식', '입식', '좌식·입식']

const EMPTY = {
  name: '', address: '', region: '', phone: '', cuisine: '한식', companions: [], hasRoom: null, roomCapacity: '',
  babyChair: null, playroom: null, parking: null, seating: null, stairs: null, priceRange: null, menu: [],
  hours: '', closedDays: '', intro: '', owner: '', closed: null, article: { title: '', url: '', date: '' },
}

/** 있음/없음/모름 세 가지 중 하나를 고르는 큰 버튼 */
function Tri({ label, value, onChange, yes = '있음', no = '없음' }) {
  const opts = [[true, yes], [false, no], [null, '모름']]
  return (
    <div className="tri">
      <span className="tri-label">{label}</span>
      <div className="tri-buttons" role="group" aria-label={label}>
        {opts.map(([v, t]) => (
          <button key={t} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

const menuToText = (menu) => menu.map((m) => (m.price ? `${m.name} | ${m.price}` : m.name)).join('\n')
const textToMenu = (t) => t.split('\n').map((line) => {
  const [name, ...rest] = line.split('|')
  return { name: name.trim(), price: rest.join('|').trim() || null }
}).filter((m) => m.name)

export default function AdminEdit() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { data } = useRestaurants()
  const original = useMemo(() => (isNew ? null : data?.find((r) => r.id === id)), [data, id, isNew])
  const [form, setForm] = useState(null)
  const [menuText, setMenuText] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (form) return
    if (isNew) {
      setForm(EMPTY)
    } else if (original) {
      setForm({ ...EMPTY, ...original, roomCapacity: original.roomCapacity ?? '', region: original.region ?? '' })
      setMenuText(menuToText(original.menu))
    }
  }, [isNew, original, form])

  const regions = useMemo(() => {
    const dongs = [...new Set((data ?? []).filter((r) => r.area === '시내').map((r) => r.region))].sort()
    return [...dongs, ...EUP_MYEON]
  }, [data])

  if (!getToken()) return <Navigate to="/admin" replace />
  if (!data) return <p className="status">불러오는 중…</p>
  if (!isNew && !original) return <p className="status">가게를 찾을 수 없어요. <Link to="/admin">목록으로</Link></p>
  if (!form) return null

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const toggleCompanion = (tag) =>
    set('companions', form.companions.includes(tag) ? form.companions.filter((t) => t !== tag) : [...form.companions, tag])

  const handle = async (fn) => {
    setBusy(true)
    setStatus(null)
    try {
      await fn()
    } catch (e) {
      if (e instanceof AuthError) navigate('/admin', { replace: true })
      setStatus({ error: true, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  const save = () => handle(async () => {
    const payload = {
      ...form,
      region: form.region || null,
      roomCapacity: form.roomCapacity === '' ? null : Number(form.roomCapacity),
      menu: textToMenu(menuText),
      article: { ...form.article, date: form.article.date || null, url: form.article.url || null },
    }
    if (isNew) {
      const rec = await createRestaurant(payload)
      updateCache((all) => [rec, ...all])
      navigate(`/admin/r/${rec.id}`, { replace: true })
      setStatus({ text: '추가했어요.' })
    } else {
      const rec = await updateRestaurant(id, payload)
      updateCache((all) => all.map((r) => (r.id === id ? rec : r)))
      setForm({ ...EMPTY, ...rec, roomCapacity: rec.roomCapacity ?? '', region: rec.region ?? '' })
      setStatus({ text: `저장했어요. 최종확인일 ${rec.lastChecked}` })
    }
  })

  const remove = () => {
    if (!window.confirm(`'${form.name}'을(를) 삭제할까요? 되돌릴 수 없어요.`)) return
    handle(async () => {
      await deleteRestaurant(id)
      updateCache((all) => all.filter((r) => r.id !== id))
      navigate('/admin', { replace: true })
    })
  }

  return (
    <div className="admin edit">
      <header className="header admin-header">
        <Link to="/admin" className="back">← 관리 목록</Link>
        {!isNew && <Link to={`/r/${id}`} className="link-btn">앱에서 보기</Link>}
      </header>
      <h1>{isNew ? '새 가게 추가' : form.name || '(상호 확인 중)'}</h1>
      {!isNew && (
        <p className="muted">
          최종확인일 {original.lastChecked ?? '없음'}
          {original.article?.url && <> · <a href={original.article.url} target="_blank" rel="noreferrer">기사 보기</a></>}
        </p>
      )}

      <section className="panel">
        <h2>방문 체크</h2>
        <Tri label="영업 상태" value={form.closed === null ? null : !form.closed} yes="영업 중" no="폐업"
          onChange={(v) => set('closed', v === null ? null : !v)} />
        <Tri label="룸" value={form.hasRoom} onChange={(v) => set('hasRoom', v)} />
        {form.hasRoom === true && (
          <Field label="룸 최대 인원">
            <input type="number" inputMode="numeric" min="1" value={form.roomCapacity} onChange={(e) => set('roomCapacity', e.target.value)} />
          </Field>
        )}
        <Tri label="아기의자" value={form.babyChair} onChange={(v) => set('babyChair', v)} />
        <Tri label="놀이방" value={form.playroom} onChange={(v) => set('playroom', v)} />
        <Tri label="주차" value={form.parking} onChange={(v) => set('parking', v)} />
        <Tri label="계단" value={form.stairs} onChange={(v) => set('stairs', v)} />
        <div className="tri">
          <span className="tri-label">좌석</span>
          <div className="tri-buttons">
            {[...SEATING, null].map((v) => (
              <button key={v ?? 'none'} type="button" className={form.seating === v ? 'on' : ''} onClick={() => set('seating', v)}>
                {v ?? '모름'}
              </button>
            ))}
          </div>
        </div>
        <p className="tri-label">식사상대 (여러 개 선택)</p>
        <div className="chips">
          {COMPANIONS.map((c) => (
            <button key={c.tag} type="button" className={`chip${form.companions.includes(c.tag) ? ' on' : ''}`}
              aria-pressed={form.companions.includes(c.tag)} onClick={() => toggleCompanion(c.tag)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>기본 정보</h2>
        <Field label="상호 *"><input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="음식종류">
          <select value={form.cuisine} onChange={(e) => set('cuisine', e.target.value)}>
            {CUISINES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="지역(동·읍·면)">
          <select value={form.region} onChange={(e) => set('region', e.target.value)}>
            <option value="">확인 중</option>
            {regions.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="주소"><input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="전화"><input type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="가격대">
          <select value={form.priceRange ?? ''} onChange={(e) => set('priceRange', e.target.value || null)}>
            <option value="">확인 중</option>
            {PRICE_RANGES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="영업시간"><input value={form.hours ?? ''} onChange={(e) => set('hours', e.target.value)} /></Field>
        <Field label="휴무일"><input value={form.closedDays ?? ''} onChange={(e) => set('closedDays', e.target.value)} /></Field>
        <Field label="한줄소개"><input value={form.intro ?? ''} onChange={(e) => set('intro', e.target.value)} /></Field>
        <Field label="대표자"><input value={form.owner ?? ''} onChange={(e) => set('owner', e.target.value)} /></Field>
        <Field label="대표메뉴 (한 줄에 하나, '이름 | 가격')">
          <textarea rows={6} value={menuText} onChange={(e) => setMenuText(e.target.value)} placeholder={'짬뽕 | 9000원\n탕수육 | 1만8000원'} />
        </Field>
      </section>

      <section className="panel">
        <h2>기사</h2>
        <Field label="기사 제목"><input value={form.article.title ?? ''} onChange={(e) => set('article', { ...form.article, title: e.target.value })} /></Field>
        <Field label="기사 링크"><input type="url" value={form.article.url ?? ''} onChange={(e) => set('article', { ...form.article, url: e.target.value })} /></Field>
        <Field label="게재일"><input type="date" value={form.article.date ?? ''} onChange={(e) => set('article', { ...form.article, date: e.target.value })} /></Field>
      </section>

      {!isNew && (
        <button type="button" className="btn danger wide" onClick={remove} disabled={busy}>이 가게 삭제</button>
      )}

      <div className="save-bar">
        {status && <p className={status.error ? 'error' : 'ok'} role="status">{status.text}</p>}
        <button type="button" className="btn primary wide" onClick={save} disabled={busy || !form.name}>
          {busy ? '저장 중…' : isNew ? '추가하기' : '저장 (최종확인일 오늘로)'}
        </button>
      </div>
    </div>
  )
}
