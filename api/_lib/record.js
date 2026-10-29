// 관리 화면에서 보낸 값을 검사해 저장할 수 있는 형태로 바꾼다.
export const CUISINES = ['한식', '중식', '일식', '양식', '분식', '카페·디저트', '외국음식', '기타', '식당외']
export const EUP_MYEON = ['합덕읍', '송악읍', '고대면', '석문면', '대호지면', '정미면', '면천면', '순성면', '우강면',
  '신평면', '송산면']
export const COMPANION_TAGS = ['업무미팅룸', '부모님·가족', '어린이동반', '혼밥', '회식']
export const SEATING = ['좌식', '입식', '좌식·입식']
export const PRICE_RANGES = ['1만원 미만', '1~2만원', '2~3만원', '3만원 이상']

/** 한국 시간 기준 오늘 날짜 (YYYY-MM-DD) */
export const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

const text = (v, max = 500) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim().slice(0, max)
  return s === '' ? null : s
}
const tri = (v) => (v === true || v === false ? v : null)
const num = (v, min, max) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}
const oneOf = (v, list) => (list.includes(v) ? v : null)
const isUrl = (v) => typeof v === 'string' && /^https?:\/\//.test(v)

const FIELDS = {
  name: (v) => text(v, 80),
  address: (v) => text(v, 200),
  region: (v) => text(v, 20),
  phone: (v) => text(v, 30),
  lat: (v) => num(v, 33, 39),
  lng: (v) => num(v, 124, 132),
  // 모르는 음식종류는 무시해서 기존 값을 지킨다 (undefined = 이 필드는 바꾸지 않음)
  cuisine: (v) => oneOf(v, CUISINES) ?? undefined,
  companions: (v) => (Array.isArray(v) ? [...new Set(v.filter((t) => COMPANION_TAGS.includes(t)))] : []),
  hasRoom: tri,
  roomCapacity: (v) => num(v, 1, 500),
  babyChair: tri,
  playroom: tri,
  parking: tri,
  seating: (v) => oneOf(v, SEATING),
  stairs: tri,
  priceRange: (v) => oneOf(v, PRICE_RANGES),
  menu: (v) => (Array.isArray(v)
    ? v.slice(0, 30).map((m) => ({ name: text(m?.name, 60), price: text(m?.price, 40) })).filter((m) => m.name)
    : []),
  hours: (v) => text(v, 300),
  closedDays: (v) => text(v, 100),
  intro: (v) => text(v, 200),
  owner: (v) => text(v, 60),
  closed: tri,
  photo: (v) => (isUrl(v) ? v.slice(0, 500) : null),
  article: (v) => ({
    title: text(v?.title, 200),
    url: isUrl(v?.url) ? v.url.slice(0, 300) : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(v?.date ?? '') ? v.date : null,
  }),
}

/** 보낸 값 중 아는 필드만 골라 검사한다. 보내지 않은 필드는 건드리지 않는다. */
export function sanitizePatch(input) {
  const out = {}
  for (const [key, clean] of Object.entries(FIELDS)) {
    if (input && key in input) {
      const v = clean(input[key])
      if (v !== undefined) out[key] = v
    }
  }
  if ('region' in out) out.area = !out.region ? null : EUP_MYEON.includes(out.region) ? out.region : '시내'
  return out
}

export function blankRecord() {
  return {
    id: null, name: null, address: null, region: null, area: null, phone: null, lat: null, lng: null,
    cuisine: '기타', companions: [], hasRoom: null, roomCapacity: null, babyChair: null, playroom: null,
    parking: null, seating: null, stairs: null, priceRange: null, menu: [], hours: null, closedDays: null,
    intro: null, owner: null, article: { title: null, url: null, date: null }, relatedArticles: [],
    articleMentions: [], closed: null, photo: null, lastChecked: null,
  }
}
