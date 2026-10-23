import { useEffect, useState } from 'react'

export const CUISINES = ['한식', '중식', '일식', '양식', '분식', '카페·디저트', '외국음식', '기타', '식당외']

export const EUP_MYEON = ['송악읍', '합덕읍', '신평면', '송산면', '석문면', '순성면', '면천면', '고대면', '정미면',
  '우강면', '대호지면']

// 식사상대 태그. hint 는 기사에 해당 시설이 '언급'된 곳(직접 확인 전)을 함께 보고 싶을 때 쓴다.
export const COMPANIONS = [
  {
    key: 'meeting', label: '업무 미팅(룸)', tag: '업무미팅룸', big: true, hint: '룸/단체석',
    match: (r) => r.companions.includes('업무미팅룸') || r.hasRoom === true,
  },
  {
    key: 'family', label: '부모님·가족', tag: '부모님·가족', big: true, hint: null,
    match: (r) => r.companions.includes('부모님·가족'),
  },
  {
    key: 'kids', label: '어린이 동반', tag: '어린이동반', big: true, hint: '놀이방',
    match: (r) => r.companions.includes('어린이동반') || r.playroom === true || r.babyChair === true,
  },
  { key: 'solo', label: '혼밥', tag: '혼밥', hint: '혼밥', match: (r) => r.companions.includes('혼밥') },
  { key: 'party', label: '회식', tag: '회식', hint: '회식·모임', match: (r) => r.companions.includes('회식') },
]

// 데이터 저장본과 화면 갱신 알림. 관리 화면에서 저장하면 updateCache 로 바로 반영한다.
let cache = null
let inflight = null
const listeners = new Set()

async function fetchData() {
  // 관리 화면에서 고친 최신 데이터는 API 에서, API 가 없는 환경(정적 배포·vite 단독 실행)에선 기본 파일에서 읽는다
  for (const url of ['/api/restaurants', '/restaurants.json']) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok && res.headers.get('content-type')?.includes('json')) return await res.json()
    } catch {
      // 다음 주소로 시도
    }
  }
  throw new Error('데이터를 불러오지 못했어요')
}

export function updateCache(fn) {
  if (!cache) return
  cache = fn(cache)
  listeners.forEach((l) => l(cache))
}

export function useRestaurants() {
  const [state, setState] = useState({ data: cache, error: null })
  useEffect(() => {
    const listener = (data) => setState({ data, error: null })
    listeners.add(listener)
    if (!cache) {
      inflight ??= fetchData()
      inflight
        .then((data) => {
          cache = data
          listeners.forEach((l) => l(cache))
        })
        .catch((error) => {
          inflight = null
          setState({ data: null, error })
        })
    }
    return () => listeners.delete(listener)
  }, [])
  return state
}

/** 필터: 음식종류·지역은 탭 안에서 '또는', 식사상대는 고른 것을 모두 만족('그리고'), 탭끼리는 '그리고' */
export function applyFilters(list, f) {
  const comps = COMPANIONS.filter((c) => f.w.includes(c.key))
  const q = f.q.trim()
  return list.filter((r) => {
    if (r.closed === true) return false
    if (f.c.length ? !f.c.includes(r.cuisine) : r.cuisine === '식당외') return false
    if (f.a.length || f.d.length) {
      const areaOk = f.a.some((a) => a !== '시내' && r.area === a)
      const dongOk = f.d.length ? f.d.includes(r.region) : f.a.includes('시내') && r.area === '시내'
      if (!areaOk && !dongOk) return false
    }
    for (const c of comps) {
      const ok = c.match(r) || (f.hint && c.hint && r.articleMentions.includes(c.hint))
      if (!ok) return false
    }
    if (q && !`${r.name ?? ''} ${r.intro ?? ''} ${r.address ?? ''} ${r.menu.map((m) => m.name).join(' ')}`.includes(q)) {
      return false
    }
    return true
  })
}

export const show = (v) => (v === null || v === undefined || v === '' ? '확인 중' : v)
export const yesNo = (v) => (v === true ? '있음' : v === false ? '없음' : '확인 중')

export function yearsAgo(dateStr) {
  if (!dateStr) return null
  return (Date.now() - new Date(dateStr).getTime()) / (365.25 * 24 * 3600 * 1000)
}

export function directionsUrl(r) {
  if (r.lat && r.lng) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(r.name ?? '목적지')},${r.lat},${r.lng}`
  }
  const target = r.address && /\d/.test(r.address) ? r.address : `당진 ${r.name ?? ''}`
  return `https://map.kakao.com/link/search/${encodeURIComponent(target)}`
}

export const telHref = (phone) => `tel:${phone.replace(/[^\d]/g, '')}`
