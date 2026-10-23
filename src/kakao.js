// 카카오맵 JavaScript SDK 로더. 키는 .env 의 VITE_KAKAO_JS_KEY 에서 읽는다.
export const KAKAO_KEY = import.meta.env.VITE_KAKAO_JS_KEY

export const DANGJIN_CENTER = { lat: 36.8898, lng: 126.6459 }

let loading = null

export function loadKakao() {
  if (!KAKAO_KEY) return Promise.reject(new Error('NO_KEY'))
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services,clusterer`
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    s.onerror = () => {
      loading = null
      reject(new Error('LOAD_FAILED'))
    }
    document.head.appendChild(s)
  })
  return loading
}

// 좌표가 없는 가게는 주소로 좌표를 찾아 이 브라우저에 저장해 두고 다시 쓴다
const GEO_KEY = 'geo-cache-v1'

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(GEO_KEY)) ?? {}
  } catch {
    return {}
  }
}

export function cachedCoords(address) {
  return address ? readCache()[address] ?? null : null
}

/** 이미 찾아본 주소인지 (찾지 못한 경우도 포함) */
export const triedGeocode = (address) => address in readCache()

export function geocode(kakao, address) {
  const cache = readCache()
  if (address in cache) return Promise.resolve(cache[address])
  return new Promise((resolve) => {
    new kakao.maps.services.Geocoder().addressSearch(address, (result, status) => {
      const hit = status === kakao.maps.services.Status.OK
        ? { lat: Number(result[0].y), lng: Number(result[0].x) }
        : null
      try {
        localStorage.setItem(GEO_KEY, JSON.stringify({ ...readCache(), [address]: hit }))
      } catch {
        // 저장 공간을 못 쓰는 환경에서는 이번 화면에서만 쓴다
      }
      resolve(hit)
    })
  })
}

/** 주소가 도로명·지번 형태일 때만 좌표 검색을 시도한다 ('○○ 맞은편' 같은 설명형은 제외) */
export const geocodable = (address) => !!address && /\d/.test(address)
