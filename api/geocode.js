// POST /api/geocode (관리자) — 좌표가 없는 가게를 한 번에 BATCH 곳씩 카카오로 찾아 저장한다.
// 관리 화면이 remaining 이 0 이 될 때까지 되풀이해서 부른다.
// 못 찾은 곳은 geoTried 에 그때 주소를 남겨 같은 주소로 다시 묻지 않는다 (주소를 고치면 다시 시도).
import { isAuthorized, json } from './_lib/auth.js'
import { KakaoKeyError, lookup } from './_lib/geo.js'
import { EUP_MYEON } from './_lib/record.js'
import { StoreError, readAll, writeAll } from './_lib/store.js'

const BATCH = 100 // 저장할 때마다 백업 버전이 하나씩 생기므로 한 번에 넉넉히 처리한다
const PARALLEL = 5
export const maxDuration = 60

const needsCoords = (r) => r.lat == null && r.address && /\d/.test(r.address) && r.geoTried !== r.address

export async function POST(request) {
  if (!isAuthorized(request)) return json({ error: '로그인이 필요해요.' }, 401)
  const key = process.env.KAKAO_REST_KEY
  if (!key) {
    return json({ error: 'Vercel 환경변수에 KAKAO_REST_KEY(카카오 REST API 키)를 넣고 다시 배포해 주세요.' }, 500)
  }
  try {
    const all = await readAll(request)
    const todo = all.filter(needsCoords).slice(0, BATCH)
    const hits = []
    for (let i = 0; i < todo.length; i += PARALLEL) {
      hits.push(...await Promise.all(todo.slice(i, i + PARALLEL).map((r) => lookup(key, r))))
    }
    let found = 0
    todo.forEach((r, i) => {
      const hit = hits[i]
      if (hit) {
        r.lat = hit.lat
        r.lng = hit.lng
        if (!r.region && hit.region) {
          r.region = hit.region
          r.area = EUP_MYEON.includes(hit.region) ? hit.region : '시내'
        }
        delete r.geoTried
        found++
      } else {
        r.geoTried = r.address
      }
    })
    if (todo.length) await writeAll(all)
    return json({
      found,
      failed: todo.length - found,
      remaining: all.filter(needsCoords).length,
      withCoords: all.filter((r) => r.lat != null).length,
      total: all.length,
    })
  } catch (e) {
    console.error(e)
    const known = e instanceof KakaoKeyError || e instanceof StoreError
    return json({ error: known ? e.message : `좌표 저장 중 오류: ${e?.message ?? e}` }, 500)
  }
}
