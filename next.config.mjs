// @ts-check
import withPWA from '@ducanh2912/next-pwa'

const isProd = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  // Add environment variable exposure for Resend
  env: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
    RESEND_CC: process.env.RESEND_CC,
    RESEND_BCC: process.env.RESEND_BCC,
  },
  // Optionally, you can also add ESLint ignore if needed
  eslint: {
    ignoreDuringBuilds: process.env.IGNORE_ESLINT === 'true',
  },
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