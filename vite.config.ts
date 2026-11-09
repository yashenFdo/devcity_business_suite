import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// ─── Security policy ──────────────────────────────────────────
// Everything (scripts, fonts, styles) is self-hosted, so the policy is very strict.
// Google sign-in is a full-page redirect through Supabase, so no Google scripts are loaded.
// Supabase (API + realtime websocket) is the only third-party origin the app talks to.
const SUPABASE = 'https://*.supabase.co wss://*.supabase.co';
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React style attributes & print styles
  "img-src 'self' data: blob: https://*.googleusercontent.com", // Google profile photos
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE}`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/** Inject the CSP as a <meta> tag in production builds (dev needs inline HMR scripts). */
const cspMeta = (): Plugin => ({
  name: 'devcity-csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspMeta()],
  build: {
    sourcemap: false,
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
  preview: {
    headers: SECURITY_HEADERS,
  },
});
