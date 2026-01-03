import { LoggerService } from './logger.service.js';

export class VectorizationService {
    private extractor: any = null;

    constructor(private readonly logger: LoggerService) { }

    /**
     * ベクトル化モデルの初期化 (GPU/CPU判定)
     */
    async init(): Promise<void> {
        if (process.env.USE_GPU === 'true') {
            this.logger.info('ベクトル化モデルを初期化中 (GPU有効)...');
            const { pipeline } = await import('@xenova/transformers');
            // @ts-ignore - device option is present in runtime but missing in types
            this.extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { device: 'gpu' });
        } else {
            this.logger.info('ベクトル化モデルを初期化中 (CPU)...');
            const { pipeline } = await import('@xenova/transformers');
            this.extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
        }
    }

    async vectorize(text: string): Promise<number[]> {
        if (!text || !this.extractor) return [];
        try {
            const output = await this.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data) as number[];
        } catch (e) {
            this.logger.error(`ベクトル化に失敗しました: ${e}`);
            return [];
        }
    }
}
