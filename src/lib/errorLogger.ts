export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  timestamp: string;
  userAgent: string;
  url: string;
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 100;

  constructor() {
    // Only setup handlers in browser environment
    if (typeof window !== 'undefined') {
      this.setupGlobalHandlers();
    }
  }

  private setupGlobalHandlers() {
    window.addEventListener('error', (event) => {
      this.logError(
        event.message,
        ErrorSeverity.HIGH,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        event.error?.stack
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError(
        event.reason?.message || 'Unhandled Promise Rejection',
        ErrorSeverity.HIGH,
        { reason: event.reason },
        event.reason?.stack
      );
    });
  }

  logError(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>,
    stack?: string
  ) {
    const errorLog: ErrorLog = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      stack,
      severity,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    this.logs.push(errorLog);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (false) {
      console.error(`[${severity.toUpperCase()}]`, message, context, stack);
    }
  }

  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const errorLogger = new ErrorLogger();
