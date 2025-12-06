import axios from 'axios';
import { LoggerService } from '../services/logger.service.js';
import { IIrbankClient } from './irbank.client.interface.js';

export class IrbankClient implements IIrbankClient {
  constructor(private readonly logger: LoggerService) { }

  async fetchFinancialData(yearCode: string, fileName: string): Promise<any> {
    const url = this.buildUrl(yearCode, fileName);
    this.logger.info(`Fetching data from ${url}`, { yearCode, fileName });

    try {
      const response = await this.executeRequest(url);
      return this.processResponse(response, url);
    } catch (error) {
      return this.handleError(error, url);
    }
  }

  private buildUrl(yearCode: string, fileName: string): string {
    return `https://f.irbank.net/files/${yearCode}/${fileName}`;
  }

  private async executeRequest(url: string) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    };
    return await axios.get(url, {
      headers,
      maxRedirects: 0, // リダイレクトを検出するために無効化
      validateStatus: (status) => status < 400 // 3xxもエラーとして扱う
    });
  }

  private processResponse(response: any, url: string): any {
    // 302リダイレクトはレートリミットと判断
    if (response.status === 302) {
      this.throwRateLimitError(url, response.status, response.headers.location);
    }

    if (response.status === 200) {
      return response.data;
    }

    const error = new Error(`Failed to fetch data from ${url}. Status: ${response.status}`);
    this.logger.error(error.message, { url, status: response.status });
    throw error;
  }

  private handleError(error: unknown, url: string): null {
    // 302エラーの場合は再スローして上位でキャッチさせる
    if (error instanceof Error && error.message.includes('Rate limit detected')) {
      throw error;
    }

    // axiosのエラーレスポンスをチェック
    if (axios.isAxiosError(error) && error.response?.status === 302) {
      this.throwRateLimitError(url, 302, error.response.headers.location);
    }

    this.logger.error(`Error fetching data from ${url}`, { error: error instanceof Error ? error.stack : String(error) });
    return null;
  }

  private throwRateLimitError(url: string, status: number, location: string): never {
    const error = new Error(`Rate limit detected (302 redirect) at ${url}`);
    this.logger.error('RATE LIMIT ERROR: 302 redirect detected. Stopping batch immediately.', {
      url,
      status,
      location
    });
    throw error;
  }
}
