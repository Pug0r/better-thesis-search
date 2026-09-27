import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devSearchIndex } from './vite/dev-search-index.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devSearchIndex()],
  base: process.env.GITHUB_ACTIONS ? '/better-thesis-search/' : '/',
})
