import { Logger } from './logger';
import { errorLogger, ErrorSeverity } from './errorLogger';
import { NotificationService } from './notificationService';

export type ErrorCode =
  | 'UNKNOWN_ERROR'
  | 'VALIDATION_ERROR'
  | 'CSG_OPERATION_FAILED'
  | 'INVALID_MESH'
  | 'NO_GEOMETRY'
  | 'UNSUPPORTED_FORMAT'
  | 'EXPORT_FAILED'
  | 'RATE_LIMITED'
  | 'WEBGL_ERROR'
  | 'STORAGE_ERROR'
  | string;

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public severity: 'error' | 'warning' | 'info' = 'error',
    public details?: Record<string, unknown>,
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
 * معالج الأخطاء المركزي الموحد (ErrorHandler)
 * يدمج AppError + ErrorLogger + Logger + NotificationService في نظام متكامل.
 */
export class ErrorHandler {
  private static listeners: Array<(error: AppError) => void> = [];
  private static errorLog: AppError[] = [];
  private static readonly MAX_LOG_SIZE = 100;

  static subscribe(listener: (error: AppError) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  static handle(
    error: unknown,
    context?: string | Record<string, unknown>,
    notifyUser: boolean = false
  ): AppError {
    let appError: AppError;
    const contextObj = typeof context === 'string' ? { context } : (context || {});
    const contextStr = typeof context === 'string' ? context : JSON.stringify(context || '');

    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = new AppError(
        'UNKNOWN_ERROR',
        error.message,
        'error',
        {
          stack: error.stack,
          ...contextObj
        }
      );
    } else if (typeof error === 'string') {
      appError = new AppError(
        'UNKNOWN_ERROR',
        error,
        'error',
        contextObj
      );
    } else {
      appError = new AppError(
        'UNKNOWN_ERROR',
        'حدث خطأ غير متوقع',
        'error',
        { ...contextObj, originalError: error }
      );
    }

    this.logError(appError, contextStr);
    this.notifyListeners(appError);

    if (notifyUser) {
      if (appError.severity === 'error') {
        NotificationService.error(appError.message);
      } else if (appError.severity === 'warning') {
        NotificationService.warning(appError.message);
      } else {
        NotificationService.info(appError.message);
      }
    }

    return appError;
  }

  private static logError(error: AppError, contextStr?: string): void {
    this.errorLog.push(error);

    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift();
    }

    // تكامل مباشر مع ErrorLogger و Logger المركزي
    const mappedSeverity =
      error.severity === 'error'
        ? ErrorSeverity.HIGH
        : error.severity === 'warning'
          ? ErrorSeverity.MEDIUM
          : ErrorSeverity.LOW;

    errorLogger.logError(
      `[${error.code}] ${error.message}`,
      mappedSeverity,
      error.details,
      typeof error.details?.stack === 'string' ? error.details.stack : error.stack
    );

    if (error.severity === 'error') {
      Logger.error(`[${error.code}] ${error.message}`, contextStr, error);
    } else if (error.severity === 'warning') {
      Logger.warn(`[${error.code}] ${error.message}`, contextStr, error.details);
    } else {
      Logger.info(`[${error.code}] ${error.message}`, contextStr, error.details);
    }
  }

  private static notifyListeners(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('خطأ في مستمع الأخطاء:', err);
      }
    });
  }

  static getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  static clearErrorLog(): void {
    this.errorLog = [];
    errorLogger.clearLogs();
  }

  static getLastError(): AppError | null {
    return this.errorLog.length > 0 ? this.errorLog[this.errorLog.length - 1] : null;
  }

  static getErrorCount(): number {
    return this.errorLog.length;
  }
}

export function createError(
  code: ErrorCode,
  message: string,
  severity: 'error' | 'warning' | 'info' = 'error',
  details?: Record<string, unknown>
): AppError {
  return new AppError(code, message, severity, details);
}

export function throwError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): never {
  const error = new AppError(code, message, 'error', details);
  ErrorHandler.handle(error);
  throw error;
}

export const errorHandler = {
  handle: (error: unknown, context?: string, notifyUser: boolean = false): string => {
    return ErrorHandler.handle(error, context, notifyUser).message;
  },
  subscribe: (listener: (error: AppError) => void) => ErrorHandler.subscribe(listener)
};
