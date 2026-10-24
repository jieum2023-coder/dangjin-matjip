// 식당 데이터 저장소.
// - Vercel: Blob 에 저장할 때마다 data/restaurants-<시각>.json 새 파일을 만들고 가장 최근 것을 읽는다.
//   (같은 이름을 덮어쓰면 CDN 캐시 때문에 잠시 예전 내용이 보일 수 있어서 버전마다 새 이름을 쓴다)
//   최근 KEEP 개 버전은 백업으로 남긴다.
//   Blob 저장소는 공개(public)·비공개(private) 어느 쪽으로 만들어도 동작한다.
// - 로컬(Blob 연결 없음): .data/restaurants.json 파일에 저장한다.
// - 아직 저장한 적이 없으면 배포에 포함된 public/restaurants.json 을 처음 데이터로 쓴다.
import fs from 'node:fs/promises'
import path from 'node:path'

const PREFIX = 'data/restaurants-'
const KEEP = 30
const LOCAL_FILE = path.join(process.cwd(), '.data', 'restaurants.json')
const SEED_FILE = path.join(process.cwd(), 'public', 'restaurants.json')

// 예전 방식은 BLOB_READ_WRITE_TOKEN, 새 방식은 BLOB_STORE_ID(+Vercel 자동 인증)로 연결된다
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)

export class StoreError extends Error {}

// 저장소의 공개 여부를 모르니 비공개 → 공개 순서로 시도하고, 성공한 쪽을 기억한다
let access = process.env.BLOB_ACCESS === 'public' || process.env.BLOB_ACCESS === 'private' ? process.env.BLOB_ACCESS : null

async function withAccess(fn) {
  const order = access ? [access] : ['private', 'public']
  let lastError
  for (const a of order) {
    try {
      const result = await fn(a)
      access = a
      return result
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

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

const newestFirst = (blobs) => blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))

export async function readAll(request) {
  if (useBlob()) {
    const { list, get } = await import('@vercel/blob')
    const { blobs } = await list({ prefix: PREFIX })
    if (blobs.length) {
      const latest = newestFirst(blobs)[0]
      const res = await withAccess(async (a) => {
        const r = await get(latest.pathname, { access: a, useCache: false })
        if (!r || r.statusCode !== 200) throw new Error(`blob ${latest.pathname} 읽기 실패`)
        return r
      })
      return new Response(res.stream).json()
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
    if (process.env.VERCEL) {
      throw new StoreError('저장소(Vercel Blob)가 이 프로젝트에 연결되지 않았어요. Storage에서 Blob을 연결한 뒤 다시 배포해 주세요.')
    }
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true })
    await fs.writeFile(LOCAL_FILE, body)
    return
  }
  const { put, list, del } = await import('@vercel/blob')
  await withAccess((a) => put(`${PREFIX}${Date.now()}.json`, body, {
    access: a,
    contentType: 'application/json',
    addRandomSuffix: false,
  }))
  const { blobs } = await list({ prefix: PREFIX })
  const old = newestFirst(blobs).slice(KEEP)
  if (old.length) await del(old.map((b) => b.url))
}
