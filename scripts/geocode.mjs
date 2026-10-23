// 카카오 로컬 API(REST 키)로 주소 → 좌표·법정동을 찾아 scripts/geo_cache.json 에 저장하고
// public/restaurants.json 의 lat/lng 와 비어 있는 region/area 를 채운다.
//
// 실행: KAKAO_REST_KEY=키 node scripts/geocode.mjs   (또는 .env 에 KAKAO_REST_KEY 를 넣고 실행)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DATA = path.join(ROOT, 'public', 'restaurants.json')
const CACHE = path.join(ROOT, 'scripts', 'geo_cache.json')
const EUP_MYEON = ['합덕읍', '송악읍', '고대면', '석문면', '대호지면', '정미면', '면천면', '순성면', '우강면', '신평면', '송산면']

function readEnvKey() {
  if (process.env.KAKAO_REST_KEY) return process.env.KAKAO_REST_KEY
  const env = path.join(ROOT, '.env')
  if (!fs.existsSync(env)) return null
  const m = fs.readFileSync(env, 'utf8').match(/^KAKAO_REST_KEY=(.+)$/m)
  return m ? m[1].trim() : null
}

const KEY = readEnvKey()
if (!KEY) {
  console.error('KAKAO_REST_KEY 가 없습니다. .env 에 KAKAO_REST_KEY=REST API 키 를 넣어 주세요.')
  process.exit(1)
}

async function kakao(endpoint, query) {
  const url = `https://dapi.kakao.com/v2/local/search/${endpoint}.json?query=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return (await res.json()).documents
}

// 주소 뒤에 붙은 '1층', '(○○ 옆)' 같은 부분을 떼고 검색한다
const cleanAddress = (a) => a.replace(/\(.*?\)/g, '').replace(/,.*$/, '').replace(/\s+\d+층.*$/, '').trim()

async function lookup(r) {
  const docs = await kakao('address', cleanAddress(r.address))
  const d = docs.find((x) => x.address_name.includes('당진')) ?? null
  if (d) {
    const region = d.address?.region_3depth_name || d.road_address?.region_3depth_name || null
    return { lat: Number(d.y), lng: Number(d.x), region, how: 'address' }
  }
  // 주소로 못 찾으면 '당진 상호' 키워드 검색으로 한 번 더 시도한다
  if (r.name) {
    const kw = await kakao('keyword', `당진 ${r.name}`)
    const k = kw.find((x) => x.address_name.includes('당진'))
    if (k) {
      const region = k.address_name.split(' ')[2] ?? null
      return { lat: Number(k.y), lng: Number(k.x), region, how: 'keyword' }
    }
  }
  return null
}

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
const list = JSON.parse(fs.readFileSync(DATA, 'utf8'))
let found = 0
let failed = []

for (const r of list) {
  if (!r.address || !/\d/.test(r.address)) continue
  if (!(r.id in cache)) {
    try {
      cache[r.id] = { address: r.address, ...(await lookup(r)) }
    } catch (e) {
      console.error('오류', r.id, e.message)
      break
    }
    await new Promise((ok) => setTimeout(ok, 120))
  }
  const c = cache[r.id]
  if (c?.lat) {
    r.lat = c.lat
    r.lng = c.lng
    if (!r.region && c.region) {
      r.region = c.region
      r.area = EUP_MYEON.includes(c.region) ? c.region : '시내'
    }
    found++
  } else failed.push(r)
}

fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2))
fs.writeFileSync(DATA, JSON.stringify(list, null, 2))
console.log(`좌표 찾음 ${found}곳, 못 찾음 ${failed.length}곳`)
for (const r of failed) console.log('  -', r.id, r.name, '|', r.address)
