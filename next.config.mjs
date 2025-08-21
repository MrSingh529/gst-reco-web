// @ts-check
import withPWA from '@ducanh2912/next-pwa'

const isProd = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
}

const pwa = withPWA({
  dest: 'public',
  disable: !isProd,
  register: true,
  scope: '/',
  sw: 'sw.js',
  cacheOnFrontendNav: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    navigateFallback: '/~offline', // offline fallback route
    runtimeCaching: [
      // Static assets (immutable Next.js build assets)
      {
        urlPattern: ({ request }) =>
          request.destination === 'style' ||
          request.destination === 'script' ||
          request.destination === 'worker',
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: ({ request }) => request.destination === 'image',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'images', expiration: { maxEntries: 200 } },
      },
      // API/HTML navigations
      {
        urlPattern: ({ request }) =>
          request.mode === 'navigate' || request.destination === 'document',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          networkTimeoutSeconds: 5,
        },
      },
    ],
  },
})

export default isProd ? pwa(baseConfig) : baseConfig