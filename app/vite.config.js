import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative so the static build works from any subpath.
export default defineConfig({
  plugins: [react()],
  base: './',
})
