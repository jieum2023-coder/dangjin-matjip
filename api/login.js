// POST /api/login { password } → { token, expiresAt }
import { checkPassword, issueToken, json, passwordConfigured } from './_lib/auth.js'

export async function POST(request) {
  if (!passwordConfigured()) {
    return json({ error: '관리자 비밀번호(ADMIN_PASSWORD)가 서버에 설정되지 않았어요.' }, 500)
  }
  let password = ''
  try {
    password = (await request.json()).password
  } catch {
    // 빈 요청
  }
  if (!checkPassword(password)) {
    // 비밀번호를 연달아 맞혀 보기 어렵게 조금 기다렸다 답한다
    await new Promise((ok) => setTimeout(ok, 800))
    return json({ error: '비밀번호가 맞지 않아요.' }, 401)
  }
  return json(issueToken())
}
