import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
    plugins: [react(), viteSingleFile()],
    root: path.resolve(__dirname, 'src/ui'),
    build: {
        outDir: path.resolve(__dirname, 'dist'),
        emptyOutDir: false,
        rollupOptions: {
            input: path.resolve(__dirname, 'src/ui/index.html'),
            output: {
                entryFileNames: 'ui.js',
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
