// 관리자 비밀번호 확인과 로그인 토큰. 비밀번호는 환경변수 ADMIN_PASSWORD 에만 둔다.
import crypto from 'node:crypto'

const TOKEN_HOURS = 12

const secret = () => process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || ''

const sign = (exp) => crypto.createHmac('sha256', secret()).update(`admin:${exp}`).digest('hex')

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export const passwordConfigured = () => !!process.env.ADMIN_PASSWORD

export const checkPassword = (pw) => passwordConfigured() && safeEqual(pw ?? '', process.env.ADMIN_PASSWORD)

export function issueToken() {
  const exp = Date.now() + TOKEN_HOURS * 3600 * 1000
  return { token: `${exp}.${sign(exp)}`, expiresAt: exp }
}

export function isAuthorized(request) {
  if (!passwordConfigured()) return false
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  return safeEqual(sig, sign(exp))
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
