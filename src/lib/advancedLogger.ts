// AdvancedLogger.ts
import { ErrorSeverity, errorLogger } from './errorLogger';

export interface ErrorEntry {
  timestamp: string;
  code: string;
  message: string;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  stack?: string;
  userAgent: string;
  url: string;
  memory: number;
}

export class AdvancedLogger {
  private static errorLog: ErrorEntry[] = [];
  private static readonly MAX_ERRORS = 100;

  static logError(
    code: string,
    message: string,
    context: string,
    error?: Error,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    const entry: ErrorEntry = {
      timestamp: new Date().toISOString(),
      code,
      message,
      context,
      severity,
      stack: error?.stack || new Error().stack,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      memory: typeof performance !== 'undefined' && (performance as any).memory
        ? (performance as any).memory.usedJSHeapSize
        : 0
    };

    this.errorLog.push(entry);
    if (this.errorLog.length > this.MAX_ERRORS) {
      this.errorLog.shift();
    }

    // Integrate with existing errorLogger as well
    let severityEnum = ErrorSeverity.MEDIUM;
    if (severity === 'low') severityEnum = ErrorSeverity.LOW;
    if (severity === 'high') severityEnum = ErrorSeverity.HIGH;
    if (severity === 'critical') severityEnum = ErrorSeverity.CRITICAL;

    errorLogger.logError(
      `[${code}] ${message}`,
      severityEnum,
      { context, memory: entry.memory },
      entry.stack
    );

    // Print to Console
    this.printToConsole(entry);

    // Send Critical Errors
    if (severity === 'critical') {
      this.reportToServer(entry).catch((err) => {
        console.error('Failed to report critical error to server:', err);
      });
    }
  }

  private static printToConsole(entry: ErrorEntry): void {
    const colors = {
      low: '\x1b[36m',      // cyan
      medium: '\x1b[33m',   // yellow
      high: '\x1b[31m',     // red
      critical: '\x1b[41m'  // red background
    };

    const reset = '\x1b[0m';
    const color = colors[entry.severity] || '';

    console.log(
      `${color}[${entry.code}]${reset} ${entry.message}`,
      {
        context: entry.context,
        severity: entry.severity,
        timestamp: entry.timestamp
      }
    );

    if (entry.stack) {
      console.log(entry.stack);
    }
  }

  private static async reportToServer(entry: ErrorEntry): Promise<void> {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (err) {
      console.error('فشل في إرسال الخطأ إلى الخادم:', err);
    }
  }

  static getErrorLog(): ErrorEntry[] {
    return [...this.errorLog];
  }

  static exportErrorLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }
}
