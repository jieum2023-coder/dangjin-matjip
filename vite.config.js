import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 개발·미리보기 때 /api 요청은 로컬 API 서버(npm run dev:api)로 넘긴다
const apiProxy = { '/api': 'http://localhost:3001' }

export default defineConfig({
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '당진 맛집 - 당진시대 신설상가',
        short_name: '당진 맛집',
        description: '당진시대 신설상가 코너에 소개된 당진 식당 모음',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        background_color: '#fffaf3',
        theme_color: '#c8481e',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        // 식당 데이터는 새 버전을 먼저 확인하고, 오프라인일 때만 저장본을 쓴다
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/restaurants.json' || url.pathname === '/thumbs.json' || url.pathname === '/api/restaurants',
            handler: 'NetworkFirst',
            options: { cacheName: 'restaurants-data' },
          },
        ],
      },
    }),
  ],
})
