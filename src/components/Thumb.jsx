import { useState } from 'react'

// 사진이 없으면 음식종류별 그림 타일을 보여 준다.
// (기사 사진은 저작권이 신문사에 있어 쓰지 않고, 관리 화면에서 직접 넣은 사진만 쓴다)
const ICONS = {
  한식: '🍚', 중식: '🥟', 일식: '🍣', 양식: '🍝', 분식: '🍢',
  '카페·디저트': '☕', 외국음식: '🌮', 기타: '🍽️', 식당외: '🛍️',
}

export default function Thumb({ r, big = false }) {
  const [broken, setBroken] = useState(false)
  const cls = `thumb${big ? ' big' : ''}`
  if (r.photo && !broken) {
    return <img className={cls} src={r.photo} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
  }
  return (
    <span className={`${cls} t-${Object.keys(ICONS).indexOf(r.cuisine) + 1 || 8}`} aria-hidden="true">
      {ICONS[r.cuisine] ?? ICONS.기타}
    </span>
  )
}
