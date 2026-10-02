import { defineConfig } from 'vitest/config'

// Unit tests only exercise plain modules; the app's Vite plugins (TanStack
// Start, Nitro, devtools) aren't needed and break module loading under Vitest.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
