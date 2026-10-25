export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public severity: 'error' | 'warning' | 'info' = 'error',
    public details?: Record<string, any>,
    public timestamp: Date = new Date()
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toString(): string {
    return `[${this.code}] ${this.message}`;
  }
}

/**
 * معالج الأخطاء الموحد
 */
export class ErrorHandler {
  private static listeners: Array<(error: AppError) => void> = [];
  private static errorLog: AppError[] = [];
  private static readonly MAX_LOG_SIZE = 100;

  /**
   * الاشتراك في أحداث الأخطاء
   */
  static subscribe(listener: (error: AppError) => void): () => void {
    this.listeners.push(listener);
    // إرجاع دالة للإلغاء
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * معالجة الخطأ
   */
  static handle(error: unknown, context?: string): AppError {
    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = new AppError(
        'UNKNOWN_ERROR',
        error.message,
        'error',
        {
          stack: error.stack,
          context
        }
      );
    } else if (typeof error === 'string') {
      appError = new AppError(
        'UNKNOWN_ERROR',
        error,
        'error',
        { context }
      );
    } else {
      appError = new AppError(
        'UNKNOWN_ERROR',
        'حدث خطأ غير متوقع',
        'error',
        { context, originalError: error }
      );
    }

    // تسجيل الخطأ
    this.logError(appError);

    // إخطار المستمعين
    this.notifyListeners(appError);

    // إرسال إلى خدمة logging (اختياري)
    if (appError.severity === 'error') {
      this.logToService(appError);
    }

    return appError;
  }

  /**
   * تسجيل الخطأ محليًا
   */
  private static logError(error: AppError): void {
    this.errorLog.push(error);

    // الحفاظ على حجم السجل
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift();
    }

    // طباعة في وحدة التحكم
    const icon = error.severity === 'error' ? '❌' : error.severity === 'warning' ? '⚠️' : 'ℹ️';
    console.log(
      `${icon} [${error.code}] ${error.message}`,
      error.details || ''
    );
  }

  /**
   * إخطار المستمعين
   */
  private static notifyListeners(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('خطأ في معالج الخطأ:', err);
      }
    });
  }

  /**
   * إرسال الخطأ إلى خدمة logging
   */
  private static logToService(error: AppError): void {
    // يمكن إرسال الخطأ إلى خادم logging مثل Sentry
  }

  /**
   * الحصول على سجل الأخطاء
   */
  static getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  /**
   * مسح سجل الأخطاء
   */
  static clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * الحصول على آخر خطأ
   */
  static getLastError(): AppError | null {
    return this.errorLog.length > 0 ? this.errorLog[this.errorLog.length - 1] : null;
  }

  /**
   * الحصول على عدد الأخطاء
   */
  static getErrorCount(): number {
    return this.errorLog.length;
  }
}

/**
 * دالة مساعدة لإنشاء AppError
 */
export function createError(
  code: string,
  message: string,
  severity: 'error' | 'warning' | 'info' = 'error',
  details?: Record<string, any>
): AppError {
  return new AppError(code, message, severity, details);
}

/**
 * دالة مساعدة لرمي خطأ مع معالجة
 */
export function throwError(
  code: string,
  message: string,
  details?: Record<string, any>
): never {
  const error = new AppError(code, message, 'error', details);
  ErrorHandler.handle(error);
  throw error;
}

/**
 * المتوافقية الكاملة للتطبيق
 */
export const errorHandler = {
  handle: (error: unknown, context?: string): string => {
    return ErrorHandler.handle(error, context).message;
  },
  subscribe: (listener: (error: AppError) => void) => ErrorHandler.subscribe(listener)
};
