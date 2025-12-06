import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LoggerService } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
const BASE_DIR = path.join(PROJECT_ROOT, 'data', 'raw', 'fundamentals');

export class RawJsonRepository {
  constructor(private readonly logger: LoggerService) {}

  public fileExists(yearCode: string, dataType: string): boolean {
    const filePath = path.join(BASE_DIR, yearCode, dataType);
    return fs.existsSync(filePath);
  }

  public async save(yearCode: string, dataType: string, data: any): Promise<void> {
    const dir = path.join(BASE_DIR, yearCode);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, dataType);
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
    this.logger.info(`Saved raw JSON to ${filePath}`);
  }
}