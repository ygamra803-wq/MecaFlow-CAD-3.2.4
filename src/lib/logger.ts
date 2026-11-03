export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown> | unknown;
  stack?: string;
}

/**
 * نظام التسجيل المركزي الموحد (Logger)
 * يدعم مستويات السجل المتعددة، الاشتراك في الأحداث، وتصدير السجلات للتشخيص.
 */
export class Logger {
  private static logs: LogEntry[] = [];
  private static readonly MAX_LOGS = 1000;
  private static minLevel = LogLevel.DEBUG;
  private static listeners: Array<(entry: LogEntry) => void> = [];

  /**
   * تسجيل رسالة في النظام المركزي
   */
  static log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: Record<string, unknown> | unknown,
    stack?: string
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      data,
      stack
    };

    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    if (level >= this.minLevel) {
      this.printToConsole(entry);
    }

    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch {
        // ignore listener failure
      }
    });
  }

  static debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  static info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  static warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  static error(message: string, context?: string, error?: Error | Record<string, unknown>, stack?: string): void {
    const isErr = error instanceof Error;
    this.log(
      LogLevel.ERROR,
      message,
      context,
      isErr ? { error: error.message, stack: error.stack } : error,
      stack || (isErr ? error.stack : undefined)
    );
  }

  static critical(message: string, context?: string, error?: Error | Record<string, unknown>, stack?: string): void {
    const isErr = error instanceof Error;
    this.log(
      LogLevel.CRITICAL,
      message,
      context,
      isErr ? { error: error.message, stack: error.stack } : error,
      stack || (isErr ? error.stack : undefined)
    );
  }

  /**
   * الاشتراك في السجلات الفورية
   */
  static subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * طباعة منسقة في وحدة التحكم
   */
  private static printToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const time = entry.timestamp.toISOString().slice(11, 19);
    const prefix = `[${time}] [${levelName}]`;
    const ctx = entry.context ? `[${entry.context}]` : '';

    if (entry.level >= LogLevel.ERROR) {
      console.error(`${prefix} ${ctx} ${entry.message}`, entry.data || '');
    } else if (entry.level === LogLevel.WARN) {
      console.warn(`${prefix} ${ctx} ${entry.message}`, entry.data || '');
    } else {
      console.log(`${prefix} ${ctx} ${entry.message}`, entry.data || '');
    }
  }

  static getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  static clearLogs(): void {
    this.logs = [];
  }

  static setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}
