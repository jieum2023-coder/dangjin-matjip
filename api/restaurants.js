// GET    /api/restaurants          전체 목록 (누구나)
// POST   /api/restaurants          새 가게 추가 (관리자)
// PUT    /api/restaurants?id=...   가게 수정 (관리자) — 최종확인일을 오늘로 바꾼다
// DELETE /api/restaurants?id=...   가게 삭제 (관리자)
import { isAuthorized, json } from './_lib/auth.js'
import { blankRecord, sanitizePatch, todayKST } from './_lib/record.js'
import { StoreError, readAll, writeAll } from './_lib/store.js'

// 저장소 오류를 숨기지 않고 관리 화면에 원인을 보여 준다
const guard = (fn) => async (request) => {
  try {
    return await fn(request)
  } catch (e) {
    console.error(e)
    const detail = e instanceof StoreError ? e.message : `저장소 오류: ${e?.message ?? e}`
    return json({ error: detail }, 500)
  }
}

const unauthorized = () => json({ error: '로그인이 필요해요.' }, 401)

async function body(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export const GET = guard(async (request) => {
  return json(await readAll(request))
})

export const POST = guard(async (request) => {
  if (!isAuthorized(request)) return unauthorized()
  const patch = sanitizePatch(await body(request))
  if (!patch.name) return json({ error: '상호를 입력해 주세요.' }, 400)
  const all = await readAll(request)
  const rec = {
    ...blankRecord(),
    ...patch,
    id: `admin-${Date.now().toString(36)}`,
    lastChecked: todayKST(),
  }
  all.unshift(rec)
  await writeAll(all)
  return json(rec, 201)
})

export const PUT = guard(async (request) => {
  if (!isAuthorized(request)) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  const all = await readAll(request)
  const i = all.findIndex((r) => r.id === id)
  if (i < 0) return json({ error: '가게를 찾을 수 없어요.' }, 404)
  const patch = sanitizePatch(await body(request))
  // 주소가 바뀌면 예전 좌표는 버린다 (지도에서 새 주소로 다시 찾음)
  if ('address' in patch && patch.address !== all[i].address && !('lat' in patch)) {
    patch.lat = null
    patch.lng = null
  }
  all[i] = { ...all[i], ...patch, id, lastChecked: todayKST() }
  await writeAll(all)
  return json(all[i])
})

export const DELETE = guard(async (request) => {
  if (!isAuthorized(request)) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  const all = await readAll(request)
  const next = all.filter((r) => r.id !== id)
  if (next.length === all.length) return json({ error: '가게를 찾을 수 없어요.' }, 404)
  await writeAll(next)
  return json({ ok: true })
})
