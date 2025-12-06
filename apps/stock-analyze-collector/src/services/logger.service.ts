import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'info' | 'error' | 'warn' | 'debug';

export class LoggerService {
  private logFilePath: string;

  constructor(logDir: string = './logs', logFileName: string = 'batch.log') {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFilePath = path.join(logDir, logFileName);
  }

  public log(level: LogLevel, message: string, meta?: object): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    const logJson = JSON.stringify(logEntry);

    // 標準出力に出力
    console.log(logJson);

    // ファイルに出力
    fs.appendFileSync(this.logFilePath, logJson + '\n');
  }

  public info(message: string, meta?: object): void {
    this.log('info', message, meta);
  }

  public error(message: string, meta?: object): void {
    this.log('error', message, meta);
  }

  public warn(message: string, meta?: object): void {
    this.log('warn', message, meta);
  }

  public debug(message: string, meta?: object): void {
    this.log('debug', message, meta);
  }
}
