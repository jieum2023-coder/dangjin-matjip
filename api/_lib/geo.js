// 카카오 로컬 API(REST 키)로 주소 → 좌표·법정동 찾기. scripts/geocode.mjs 와 같은 방식.
export class KakaoKeyError extends Error {}

async function kakao(key, endpoint, query) {
  const url = `https://dapi.kakao.com/v2/local/search/${endpoint}.json?query=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
  if (res.status === 401 || res.status === 403) {
    throw new KakaoKeyError('카카오 REST API 키가 맞지 않거나, 카카오 앱에서 카카오맵(로컬) 사용 설정이 꺼져 있어요.')
  }
  if (!res.ok) throw new Error(`카카오 ${res.status}`)
  return (await res.json()).documents
}

// 주소 뒤에 붙은 '1층', '(○○ 옆)' 같은 부분을 떼고 검색한다
const cleanAddress = (a) => a.replace(/\(.*?\)/g, '').replace(/,.*$/, '').replace(/\s+\d+층.*$/, '').trim()

/** 찾으면 { lat, lng, region }, 못 찾으면 null */
export async function lookup(key, r) {
  const docs = await kakao(key, 'address', cleanAddress(r.address))
  const d = docs.find((x) => x.address_name.includes('당진'))
  if (d) {
    const region = d.address?.region_3depth_name || d.road_address?.region_3depth_name || null
    return { lat: Number(d.y), lng: Number(d.x), region }
  }
  // 주소로 못 찾으면 '당진 상호' 키워드 검색으로 한 번 더 시도한다
  if (r.name) {
    const kw = await kakao(key, 'keyword', `당진 ${r.name}`)
    const k = kw.find((x) => x.address_name.includes('당진'))
    if (k) return { lat: Number(k.y), lng: Number(k.x), region: k.address_name.split(' ')[2] ?? null }
  }
  return null
}
