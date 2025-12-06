import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        hmr: {
            overlay: true,  // エラーオーバーレイを表示
        },
        watch: {
            usePolling: true,  // ファイル監視にポーリングを使用（WSL/Docker で必要な場合）
        },
    },
    css: {
        devSourcemap: true,  // CSS のソースマップを有効化
    },
})
