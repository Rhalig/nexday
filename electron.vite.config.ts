import { resolve } from 'path'
import { defineConfig, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * A release build without the Supabase settings would fall back to the local mock login, which lets
 * anyone in. Refuse to build it. Set ALLOW_NO_BACKEND=1 only for a throwaway local build.
 */
function requireBackend(mode: string): void {
  if (mode !== 'production' || process.env.ALLOW_NO_BACKEND === '1') return
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const url = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill it in (ALLOW_NO_BACKEND=1 skips this check).'
    )
  }
}

export default defineConfig(({ mode }) => {
  requireBackend(mode)
  return {
    main: {},
    preload: {},
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [react()]
    }
  }
})
