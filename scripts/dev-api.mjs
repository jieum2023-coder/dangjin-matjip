// 로컬에서 api/*.js 서버 함수를 Vercel과 같은 방식(Web Request/Response)으로 돌린다.
// 실행: npm run dev:api  (포트 3001, vite 개발 서버가 /api 요청을 여기로 넘긴다)
// .env 의 ADMIN_PASSWORD, BLOB_READ_WRITE_TOKEN 을 읽는다. Blob 키가 없으면 .data/ 폴더에 저장한다.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const PORT = Number(process.env.API_PORT ?? 3001)

const envFile = path.join(ROOT, '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
process.chdir(ROOT)

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '')
  const file = path.join(ROOT, 'api', `${name}.js`)
  if (!/^[a-z-]+$/.test(name) || !fs.existsSync(file)) {
    res.writeHead(404).end('not found')
    return
  }
  try {
    const mod = await import(pathToFileURL(file).href)
    const handler = mod[req.method]
    if (!handler) {
      res.writeHead(405).end('method not allowed')
      return
    }
    const chunks = []
    for await (const c of req) chunks.push(c)
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    })
    const response = await handler(request)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (e) {
    console.error(e)
    res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message }))
  }
}).listen(PORT, () => {
  console.log(`API 서버 http://localhost:${PORT} (저장: ${process.env.BLOB_READ_WRITE_TOKEN ? 'Vercel Blob' : '.data/ 로컬 파일'})`)
  if (!process.env.ADMIN_PASSWORD) console.log('주의: .env 에 ADMIN_PASSWORD 가 없어 관리 화면에 로그인할 수 없어요.')
})
