import { LoggerService } from '../services/logger.service.js';

export interface RateLimiterConfig {
    minIntervalMs: number;
}

export class RateLimiter {
    private lastRequestTime: number = 0;

    constructor(
        private readonly config: RateLimiterConfig,
        private readonly logger: LoggerService | null = null
    ) { }

    /**
     * 次のリクエストが可能になるまで待機します。
     */
    public async waitIfNeeded(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        const waitTime = this.config.minIntervalMs - elapsed;

        if (waitTime > 0) {
            if (this.logger) {
                this.logger.debug(`RateLimiter: waiting for ${waitTime}ms...`);
            }
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    public setLastRequestTime(time: number = Date.now()): void {
        this.lastRequestTime = time;
    }
}
