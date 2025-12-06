import axios from 'axios';
import { LoggerService } from '../services/logger.service.js';
import { IIrbankClient } from './irbank_client.interface.js';

export class IrbankClient implements IIrbankClient {
  constructor(private readonly logger: LoggerService) {}

  async fetchFinancialData(yearCode: string, fileName: string): Promise<any> {
    const url = `https://f.irbank.net/files/${yearCode}/${fileName}`;
    this.logger.info(`Fetching data from ${url}`, { yearCode, fileName });
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      };
      const response = await axios.get(url, { 
        headers, 
        maxRedirects: 0, // リダイレクトを検出するために無効化
        validateStatus: (status) => status < 400 // 3xxもエラーとして扱う
      });
      
      // 302リダイレクトはレートリミットと判断
      if (response.status === 302) {
        const error = new Error(`Rate limit detected (302 redirect) at ${url}`);
        this.logger.error('RATE LIMIT ERROR: 302 redirect detected. Stopping batch immediately.', { 
          url, 
          status: response.status,
          location: response.headers.location 
        });
        throw error;
      }
      
      if (response.status === 200) {
        return response.data;
      } else {
        const error = new Error(`Failed to fetch data from ${url}. Status: ${response.status}`);
        this.logger.error(error.message, { url, status: response.status });
        throw error;
      }
    } catch (error) {
      // 302エラーの場合は再スローして上位でキャッチさせる
      if (error instanceof Error && error.message.includes('Rate limit detected')) {
        throw error;
      }
      
      // axiosのエラーレスポンスをチェック
      if (axios.isAxiosError(error) && error.response?.status === 302) {
        const rateLimitError = new Error(`Rate limit detected (302 redirect) at ${url}`);
        this.logger.error('RATE LIMIT ERROR: 302 redirect detected. Stopping batch immediately.', { 
          url, 
          status: 302,
          location: error.response.headers.location 
        });
        throw rateLimitError;
      }
      
      this.logger.error(`Error fetching data from ${url}`, { error: error instanceof Error ? error.stack : String(error) });
      return null;
    }
  }
}
