import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Exclude patch files — they only run inside the Docker container after init-repo.sh
    exclude: ['workspace/patches/**', 'node_modules/**'],
  },
})
