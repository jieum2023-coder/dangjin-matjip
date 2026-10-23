// 관리 API 호출. 로그인 토큰은 이 기기에만 보관한다(12시간 뒤 만료).
const KEY = 'admin-token'

export function getToken() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY))
    return t && t.expiresAt > Date.now() ? t.token : null
  } catch {
    return null
  }
}

export function logout() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 저장 공간을 못 쓰는 환경
  }
}

export class AuthError extends Error {}

async function call(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken() ?? ''}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    logout()
    throw new AuthError(data.error ?? '다시 로그인해 주세요.')
  }
  if (!res.ok) throw new Error(data.error ?? `저장하지 못했어요 (${res.status})`)
  return data
}

export async function login(password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '로그인하지 못했어요. 서버(API)가 켜져 있는지 확인해 주세요.')
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // 저장이 안 되면 이번 화면에서만 로그인 상태
  }
  return data
}

export const createRestaurant = (rec) => call('POST', '/api/restaurants', rec)
export const updateRestaurant = (id, patch) => call('PUT', `/api/restaurants?id=${encodeURIComponent(id)}`, patch)
export const deleteRestaurant = (id) => call('DELETE', `/api/restaurants?id=${encodeURIComponent(id)}`)
