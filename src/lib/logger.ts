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
  data?: any;
  stack?: string;
}

export class Logger {
  private static logs: LogEntry[] = [];
  private static readonly MAX_LOGS = 1000;
  private static minLevel = LogLevel.DEBUG;

  /**
   * تسجيل رسالة
   */
  static log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: any
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      data
    };

    // إضافة إلى السجل
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // طباعة في وحدة التحكم
    if (level >= this.minLevel) {
      this.printToConsole(entry);
    }

    // إرسال الأخطاء الحرجة إلى خدمة monitoring
    if (level === LogLevel.CRITICAL) {
      this.reportCritical(entry);
    }
  }

  static debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  static info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  static warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  static error(message: string, context?: string, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, {
      error: error?.message,
      stack: error?.stack
    });
  }

  static critical(message: string, context?: string, error?: Error): void {
    this.log(LogLevel.CRITICAL, message, context, {
      error: error?.message,
      stack: error?.stack
    });
  }

  /**
   * طباعة في وحدة التحكم
   */
  private static printToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const time = entry.timestamp.toLocaleTimeString('ar-SA');
    const prefix = `[${time}] [${levelName}]`;

    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m',    // أزرق
      [LogLevel.INFO]: '\x1b[32m',     // أخضر
      [LogLevel.WARN]: '\x1b[33m',     // أصفر
      [LogLevel.ERROR]: '\x1b[31m',    // أحمر
      [LogLevel.CRITICAL]: '\x1b[41m'  // خلفية حمراء
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level];

    console.log(
      `${color}${prefix}${reset} ${entry.context ? `[${entry.context}]` : ''} ${entry.message}`,
      entry.data || ''
    );
  }

  /**
   * إرسال الأخطاء الحرجة
   */
  private static reportCritical(entry: LogEntry): void {
    // يمكن إرسال الخطأ إلى خدمة مثل Sentry
    if (typeof window !== 'undefined' && window.navigator.onLine) {
      fetch('/api/logs/critical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      }).catch(err => console.error('فشل في إرسال السجل:', err));
    }
  }

  /**
   * الحصول على السجلات
   */
  static getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  /**
   * تصدير السجلات
   */
  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * مسح السجلات
   */
  static clearLogs(): void {
    this.logs = [];
  }

  /**
   * تعيين الحد الأدنى للمستوى
   */
  static setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}
