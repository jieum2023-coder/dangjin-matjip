import { Link } from 'react-router-dom'
import { COMPANIONS, show, status } from '../data'
import Thumb from './Thumb'

export default function RestaurantCard({ r, search }) {
  const year = r.article.date?.slice(0, 4)
  const tags = COMPANIONS.filter((c) => c.match(r))
  const st = status(r)
  return (
    <li>
      <Link className={`card${st.key === 'closed' ? ' is-closed' : ''}`} to={`/r/${r.id}${search}`}>
        <Thumb r={r} />
        <div className="card-body">
          <div className="card-top">
            <h3>
              {r.name ?? '상호 확인 중'}
              {st.label && <span className={`status-pill ${st.key}`}>{st.label}</span>}
            </h3>
            <span className="pill">{r.cuisine}</span>
          </div>
          <p className="intro">{r.intro}</p>
          <p className="meta">
            <span>{show(r.region ?? r.area)}</span>
            <span>{r.priceRange ? `가격대 ${r.priceRange}` : '가격대 확인 중'}</span>
            <span className="muted">{year}년 기사</span>
          </p>
          {tags.length > 0 && (
            <p className="tags">{tags.map((t) => <span key={t.key} className="tag">{t.label}</span>)}</p>
          )}
        </div>
      </Link>
    </li>
  )
}
