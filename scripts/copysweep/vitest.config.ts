import {defineConfig} from 'vitest/config';

// Runs only the copy-sweep scripts: `npx vitest run -c scripts/copysweep/vitest.config.ts`
export default defineConfig({
  test: {
    root: './scripts/copysweep',
    environment: 'node',
    include: ['*.test.ts'],
    testTimeout: 0,
  },
});
