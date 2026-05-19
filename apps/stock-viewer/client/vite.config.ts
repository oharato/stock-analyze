import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    base: '/',
    publicDir: 'public',
    build: {
        outDir: '../dist/client',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                companies: resolve(__dirname, 'companies.html'),
                edinet: resolve(__dirname, 'edinet.html'),
                fundamentals: resolve(__dirname, 'fundamentals.html'),
                large_shareholdings: resolve(__dirname, 'large_shareholdings.html'),
                company: resolve(__dirname, 'company.html'),
                candlestick: resolve(__dirname, 'candlestick.html'),
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
});
