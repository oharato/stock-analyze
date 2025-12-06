import { IIrbankClient } from '../clients/irbank.client.interface.js';
import { FundamentalRepository } from '../repositories/fundamental.repository.js';
import { RawJsonRepository } from '../repositories/raw-json.repository.js';
import { StockRepository } from '../repositories/stock.repository.js';
import { LoggerService } from './logger.service.js';
import { sleep } from './wait.service.js';
import { Stock } from 'stock-analyze-domain';

// データ種別を分類
const FY_DATA_TYPES = [
    'fy-balance-sheet',
    'fy-cash-flow-statement',
    'fy-profit-and-loss',
    'fy-stock-dividend',
];

const Q_DATA_TYPES = [
    // 四半期（累計）
    'qy-net-sales',
    'qy-operating-income',
    'qy-ordinary-income',
    'qy-profit-loss',
    // 四半期（累計）前年同期比
    'qy-yoy-net-sales',
    'qy-yoy-operating-income',
    'qy-yoy-ordinary-income',
    'qy-yoy-profit-loss',
    // 四半期（期間）
    'qq-net-sales',
    'qq-operating-income',
    'qq-ordinary-income',
    'qq-profit-loss',
    // 四半期（期間）前年同期比
    'qq-yoy-net-sales',
    'qq-yoy-operating-income',
    'qq-yoy-ordinary-income',
    'qq-yoy-profit-loss',
];

export class FetchFundamentalsService {
    constructor(
        private readonly irbankClient: IIrbankClient,
        private readonly stockRepository: StockRepository,
        private readonly fundamentalRepository: FundamentalRepository,
        private readonly rawJsonRepository: RawJsonRepository,
        private readonly logger: LoggerService,
        private readonly yearCodes: string[],
    ) { }

    /**
     * サービスの実行
     */
    async execute(): Promise<void> {
        this.logger.info('Starting to fetch fundamentals data...');

        const stocks = await this.stockRepository.loadStockList();
        if (stocks.length === 0) {
            this.logger.warn('No stocks found. Please fetch the stock list first.');
            return;
        }

        // 既存データをチェックして、取得が必要な銘柄のみをフィルタリング
        const stocksToFetch = stocks.filter((stock) => {
            if (this.fundamentalRepository.doesDataExist(stock.code)) {
                this.logger.info(`Fundamental data for ${stock.code} already exists. Skipping.`, {
                    code: stock.code,
                });
                return false;
            }
            return true;
        });

        if (stocksToFetch.length === 0) {
            this.logger.info('All target stocks already have fundamental data. Nothing to fetch.');
            return;
        }

        this.logger.info(`Fetching data for ${stocksToFetch.length} stocks...`);

        // 全銘柄のデータが含まれているファイルを一度だけフェッチ
        const { allData, allRawData } = await this.fetchAllFinancialData();

        const allFundamentals = new Map<string, any[]>();

        for (const stock of stocksToFetch) {
            this.logger.info(`\nProcessing stock: ${stock.code} ${stock.name}`, {
                code: stock.code,
                name: stock.name,
            });

            const mergedCompanyData = this.extractCompanyData(stock, allData);

            if (mergedCompanyData.size > 0) {
                allFundamentals.set(stock.code, Array.from(mergedCompanyData.values()));
            }
        }

        // 全てのデータを保存
        if (allRawData.length > 0) {
            for (const { yearCode, fileName, data } of allRawData) {
                await this.rawJsonRepository.save(yearCode, fileName, data);
            }
        }

        if (allFundamentals.size > 0) {
            await this.fundamentalRepository.save(allFundamentals);
            this.logger.info(
                `\nSuccessfully fetched and saved fundamentals for ${allFundamentals.size} companies.`,
                { count: allFundamentals.size },
            );
        } else {
            this.logger.info('\nNo new fundamental data was fetched.');
        }

        this.logger.info('Finished fetching fundamentals data.');
    }

    /**
     * 全銘柄の財務データを一度だけフェッチ
     * @returns 全データと生データ
     */
    private async fetchAllFinancialData(): Promise<{
        allData: Map<string, Map<string, any>>;
        allRawData: any[];
    }> {
        const allData = new Map<string, Map<string, any>>(); // Key: yearCode_fileName, Value: Map of stock code to data
        const allRawData = [];

        try {
            for (const yearCode of this.yearCodes) {
                const dataTypesToFetch = yearCode === '0000' ? [...FY_DATA_TYPES, ...Q_DATA_TYPES] : FY_DATA_TYPES;

                for (const dataType of dataTypesToFetch) {
                    const fileName = `${dataType}.json`;

                    // ファイルが既に存在する場合はスキップ
                    if (this.rawJsonRepository.fileExists(yearCode, fileName)) {
                        this.logger.info(`File already exists. Skipping fetch: ${yearCode}/${fileName}`);
                        continue;
                    }

                    const data = await this.irbankClient.fetchFinancialData(yearCode, fileName);

                    if (data) {
                        allRawData.push({ yearCode, fileName, data });
                        const key = `${yearCode}_${fileName}`;

                        // メタデータとitemデータの両方を保存
                        const dataWithMeta = new Map<string, any>();
                        if (data.item) {
                            for (const [code, value] of Object.entries(data.item)) {
                                dataWithMeta.set(code, { value, meta: data.meta });
                            }
                        }
                        allData.set(key, dataWithMeta);
                    }
                }
            }
        } catch (error) {
            // レートリミットエラーの場合は即座に停止
            if (error instanceof Error && error.message.includes('Rate limit detected')) {
                this.logger.error('Rate limit detected. Stopping data fetch immediately.');
                throw error; // 上位に伝播させてバッチ全体を停止
            }
            throw error;
        }

        return { allData, allRawData };
    }

    /**
     * 特定銘柄のデータを全データから抽出
     * @param stock - 株式情報
     * @param allData - 全データ
     * @returns 企業データ
     */
    private extractCompanyData(
        stock: Stock,
        allData: Map<string, Map<string, any>>,
    ): Map<string, any> {
        const mergedCompanyData = new Map<string, any>(); // Key: YYYY

        for (const [key, dataMap] of allData.entries()) {
            const companyDataWithMeta = dataMap.get(stock.code);
            if (companyDataWithMeta) {
                const { value, meta } = companyDataWithMeta;
                this.parseAndMergeData(value, meta, stock.code, mergedCompanyData);
            }
        }

        return mergedCompanyData;
    }

    /**
     * データをパースしてマージ
     * @param companyData - 企業データ
     * @param meta - メタデータ
     * @param code - 銘柄コード
     * @param mergedCompanyData - マージされた企業データ
     */
    private parseAndMergeData(
        companyData: any,
        meta: any,
        code: string,
        mergedCompanyData: Map<string, any>,
    ): void {
        // companyData が配列の場合（通常のケース: ["2024/03", value1, value2, ...]）
        if (Array.isArray(companyData) && meta?.item?.code) {
            const fieldNames = meta.item.code; // ["年度", "総資産", "純資産", ...]
            const date = companyData[0];

            if (typeof date === 'string' && date.includes('/')) {
                const year = date.substring(0, 4);
                const yearData = mergedCompanyData.get(year) || { code, year };

                // メタデータのフィールド名を使って値をマッピング
                for (let i = 1; i < companyData.length && i < fieldNames.length; i++) {
                    const fieldName = fieldNames[i];
                    yearData[fieldName] = companyData[i];
                }

                mergedCompanyData.set(year, yearData);
            }
        }
        // companyData がオブジェクトの場合（日付ベース）
        else if (typeof companyData === 'object' && !Array.isArray(companyData)) {
            for (const date in companyData) {
                const year = date.substring(0, 4);
                const yearData = mergedCompanyData.get(year) || { code, year };
                Object.assign(yearData, companyData[date]);
                mergedCompanyData.set(year, yearData);
            }
        }
    }
}
