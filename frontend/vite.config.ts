/// <reference types="vitest" />
import { coverageConfigDefaults } from 'vitest/config'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/types/**', 
        'src/**/index.ts',
        'eslint.config.js',
        'vite.config.ts',
      ],
    },
  },
});
