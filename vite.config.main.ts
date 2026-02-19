import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    build: {
        outDir: path.resolve(__dirname, 'dist'),
        emptyOutDir: false,
        target: 'es2017',
        lib: {
            entry: path.resolve(__dirname, 'src/code.ts'),
            formats: ['iife'],
            name: 'code',
            fileName: () => 'code.js',
        },
        rollupOptions: {
            output: {
                extend: true,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
