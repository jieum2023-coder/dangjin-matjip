import { useEffect, useState } from 'react'

// 썸네일 순서: 관리 화면에서 넣은 사진 → 당진시대 기사 사진(허락받아 사용, 출처 표시) → 음식종류 그림
const ICONS = {
  한식: '🍚', 중식: '🥟', 일식: '🍣', 양식: '🍝', 분식: '🍢',
  '카페·디저트': '☕', 외국음식: '🌮', 기타: '🍽️', 식당외: '🛍️',
}

// 기사 번호 → 사진 주소 ({ t: 작은 사진, p: 큰 사진 }), 한 번만 불러와 함께 쓴다
let thumbs = null
let loading = null
function useThumbs() {
  const [map, setMap] = useState(thumbs)
  useEffect(() => {
    if (thumbs) return
    loading ??= fetch('/thumbs.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    let alive = true
    loading.then((m) => {
      thumbs = m
      if (alive) setMap(m)
    })
    return () => { alive = false }
  }, [])
  return map
}

const idxno = (url) => url?.match(/idxno=(\d+)/)?.[1]

/** 이 가게에 보여 줄 사진. 기사 사진이면 credit 이 true */
function usePhoto(r, big) {
  const map = useThumbs()
  if (r.photo) return { src: r.photo, credit: false }
  const hit = map?.[idxno(r.article?.url)]
  if (hit?.t) return { src: big ? hit.p : hit.t, credit: true }
  return null
}

/** big 이면 상세 화면용 큰 사진 (기사 사진이면 아래에 출처와 기사 링크) */
export default function Thumb({ r, big = false }) {
  const photo = usePhoto(r, big)
  const [broken, setBroken] = useState(null)
  const cls = `thumb${big ? ' big' : ''}`
  if (photo && broken !== photo.src) {
    const img = (
      <span className={`${cls} has-photo`}>
        <img src={photo.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setBroken(photo.src)} />
        {photo.credit && !big && <span className="credit">당진시대</span>}
      </span>
    )
    if (!big) return img
    return (
      <figure className="detail-photo">
        {img}
        {photo.credit && (
          <figcaption className="muted small">
            사진: 당진시대 · <a href={r.article.url} target="_blank" rel="noreferrer">기사 보기</a>
          </figcaption>
        )}
      </figure>
    )
  }
  if (big) return null
  return (
    <span className={`${cls} t-${Object.keys(ICONS).indexOf(r.cuisine) + 1 || 8}`} aria-hidden="true">
      {ICONS[r.cuisine] ?? ICONS.기타}
    </span>
  )
}
