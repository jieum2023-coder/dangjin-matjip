import { Link, useLocation, useParams } from 'react-router-dom'
import { COMPANIONS, directionsUrl, show, telHref, useRestaurants, yearsAgo, yesNo } from '../data'
import Footer from '../components/Footer'
import Thumb, { usePhoto } from '../components/Thumb'
import { cachedCoords } from '../kakao'

function Row({ label, children }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function DetailPhoto({ r }) {
  const photo = usePhoto(r, true)
  if (!photo) return null
  return (
    <figure className="detail-photo">
      <Thumb r={r} big />
      {photo.credit && (
        <figcaption className="muted small">
          사진: 당진시대 · <a href={r.article.url} target="_blank" rel="noreferrer">기사 보기</a>
        </figcaption>
      )}
    </figure>
  )
}

export default function Detail() {
  const { id } = useParams()
  const { search } = useLocation()
  const { data, error } = useRestaurants()

  if (error) return <p className="status">정보를 불러오지 못했어요.</p>
  if (!data) return <p className="status">불러오는 중…</p>
  const r = data.find((x) => x.id === id)
  if (!r) return <p className="status">가게를 찾을 수 없어요. <Link to={`/${search}`}>목록으로</Link></p>

  const age = yearsAgo(r.article.date)
  const tags = COMPANIONS.filter((c) => c.match(r))
  const seating = r.seating ?? null

  return (
    <>
      <header className="header detail-header">
        <Link to={`/${search}`} className="back">← 목록</Link>
      </header>

      <article className="detail">
        <DetailPhoto r={r} />
        <h1>{r.name ?? '상호 확인 중'}</h1>
        <p className="meta">
          <span className="pill">{r.cuisine}</span>
          <span>{show(r.region ?? r.area)}</span>
          {r.closed === true && <span className="pill warn">폐업</span>}
        </p>
        <p className="intro big">{r.intro}</p>

        {age > 3 && r.closed !== true && (
          <p className="notice">
            {r.article.date.slice(0, 4)}년 기사에 소개된 곳이에요. 지금도 영업하는지 방문 전에 확인해 주세요.
          </p>
        )}

        <div className="actions">
          {r.phone
            ? <a className="btn primary" href={telHref(r.phone)}>📞 전화 걸기</a>
            : <span className="btn disabled">📞 전화번호 확인 중</span>}
          <a className="btn" href={directionsUrl(r.lat ? r : { ...r, ...cachedCoords(r.address) })} target="_blank" rel="noreferrer">🧭 길찾기</a>
        </div>

        <h2>대표메뉴</h2>
        {r.menu.length ? (
          <>
            <ul className="menu">
              {r.menu.slice(0, 6).map((m, i) => (
                <li key={i}><span>{m.name}</span><span className="price">{show(m.price)}</span></li>
              ))}
            </ul>
            <p className="muted small">가격은 {r.article.date?.slice(0, 7).replace('-', '년 ')}월 기사 기준이에요.</p>
          </>
        ) : <p>확인 중</p>}

        <dl className="info">
          <Row label="가격대">{show(r.priceRange)}</Row>
          <Row label="영업시간">{show(r.hours)}</Row>
          <Row label="휴무일">{show(r.closedDays)}</Row>
          <Row label="주소">{show(r.address)}</Row>
          <Row label="전화">{show(r.phone)}</Row>
          <Row label="대표">{show(r.owner)}</Row>
        </dl>

        <h2>편의 정보</h2>
        <dl className="info">
          <Row label="식사상대">{tags.length ? tags.map((t) => t.label).join(', ') : '확인 중'}</Row>
          <Row label="룸">{yesNo(r.hasRoom)}{r.roomCapacity ? ` (최대 ${r.roomCapacity}명)` : ''}</Row>
          <Row label="아기의자">{yesNo(r.babyChair)}</Row>
          <Row label="놀이방">{yesNo(r.playroom)}</Row>
          <Row label="주차">{yesNo(r.parking)}</Row>
          <Row label="좌석">{show(seating)}</Row>
          <Row label="계단">{yesNo(r.stairs)}</Row>
          <Row label="최종 확인일">{show(r.lastChecked)}</Row>
        </dl>
        {r.articleMentions.length > 0 && (
          <p className="muted small">기사에 언급된 내용: {r.articleMentions.join(', ')} (직접 확인 전)</p>
        )}

        <a className="btn article-link" href={r.article.url} target="_blank" rel="noreferrer">
          📰 당진시대 기사 보기
        </a>
        <p className="muted small">{r.article.date} · {r.article.title}</p>
        {r.relatedArticles.length > 0 && (
          <ul className="related">
            {r.relatedArticles.map((a) => (
              <li key={a.url}><a href={a.url} target="_blank" rel="noreferrer">{a.date} 이전 기사</a></li>
            ))}
          </ul>
        )}
      </article>
      <Footer />
    </>
  )
}
