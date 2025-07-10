import { fileURLToPath, URL } from 'url';
import glsl from 'vite-plugin-glsl';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths(), glsl()],
    resolve: {
        alias: {
            '@giro3d/giro3d': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    test: {
        globals: true,
        exclude: ['**/node_modules/**', '**/build/**'],
        setupFiles: ['./vitest.setup.ts'],
        environment: 'jsdom',
        coverage: {
            reporter: ['text'],
            exclude: ['**/node_modules/**', '**/build/**'],
            include: ['**/src/**/*.ts'],
        },
    },
});
