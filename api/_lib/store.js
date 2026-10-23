// 식당 데이터 저장소.
// - Vercel: Blob 에 저장할 때마다 data/restaurants-<시각>.json 새 파일을 만들고 가장 최근 것을 읽는다.
//   (같은 이름을 덮어쓰면 CDN 캐시 때문에 잠시 예전 내용이 보일 수 있어서 버전마다 새 이름을 쓴다)
//   최근 KEEP 개 버전은 백업으로 남긴다.
// - 로컬(BLOB_READ_WRITE_TOKEN 없음): .data/restaurants.json 파일에 저장한다.
// - 아직 저장한 적이 없으면 배포에 포함된 public/restaurants.json 을 처음 데이터로 쓴다.
import fs from 'node:fs/promises'
import path from 'node:path'

const PREFIX = 'data/restaurants-'
const KEEP = 30
const LOCAL_FILE = path.join(process.cwd(), '.data', 'restaurants.json')
const SEED_FILE = path.join(process.cwd(), 'public', 'restaurants.json')

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN

async function readSeed(request) {
  try {
    return JSON.parse(await fs.readFile(SEED_FILE, 'utf8'))
  } catch {
    // 서버 함수 번들에 public/ 이 없으면 같은 사이트의 정적 파일을 읽는다
    const res = await fetch(new URL('/restaurants.json', request.url))
    if (!res.ok) throw new Error(`seed ${res.status}`)
    return res.json()
  }
}

export async function readAll(request) {
  if (useBlob()) {
    const { list } = await import('@vercel/blob')
    const { blobs } = await list({ prefix: PREFIX })
    if (blobs.length) {
      const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
      const res = await fetch(latest.url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`blob ${res.status}`)
      return res.json()
    }
  } else {
    try {
      return JSON.parse(await fs.readFile(LOCAL_FILE, 'utf8'))
    } catch {
      // 아직 저장한 적 없음
    }
  }
  return readSeed(request)
}

export async function writeAll(all) {
  const body = JSON.stringify(all)
  if (!useBlob()) {
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true })
    await fs.writeFile(LOCAL_FILE, body)
    return
  }
  const { put, list, del } = await import('@vercel/blob')
  await put(`${PREFIX}${Date.now()}.json`, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })
  const { blobs } = await list({ prefix: PREFIX })
  const old = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(KEEP)
  if (old.length) await del(old.map((b) => b.url))
}
