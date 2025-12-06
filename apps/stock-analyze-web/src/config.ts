/**
 * API Configuration
 * 
 * このファイルで API エンドポイントや設定を管理します
 */

export const config = {
    // 開発環境用の設定
    development: {
        apiEndpoint: 'http://localhost:8786',  // stock-analyze-ai のルートパス
        useMockAPI: false, // ローカル AI サーバを使用
    },

    // 本番環境用の設定
    production: {
        apiEndpoint: 'https://stock-analyze.ohchans.com/api', // Cloudflare Workers のエンドポイント
        useMockAPI: false,
    },
};

// 現在の環境を判定
const isDevelopment = import.meta.env.DEV;

// 現在の環境に応じた設定をエクスポート
export const currentConfig = isDevelopment
    ? config.development
    : config.production;

// API エンドポイント
export const API_ENDPOINT = currentConfig.apiEndpoint;

// モック API を使用するかどうか
export const USE_MOCK_API = currentConfig.useMockAPI;
