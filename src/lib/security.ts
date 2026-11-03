/**
 * أدوات الأمان وتنظيف المدخلات وتحديد معدل الطلبات (InputSanitizer & RateLimiter)
 */
export class InputSanitizer {
  /**
   * إزالة وسوم HTML والسكربتات الضارة من النصوص
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  /**
   * التحقق من صحة الأرقام ومنع القيم المتطرفة أو غير الصالحة
   */
  static sanitizeNumber(input: string | number): number | null {
    const num = typeof input === 'number' ? input : parseFloat(input);
    if (Number.isNaN(num) || !Number.isFinite(num)) return null;
    if (Math.abs(num) > 1e10) return null;
    return num;
  }

  /**
   * تنظيف كائن كامل بشكل تكراري (Recursive Sanitization)
   */
  static sanitizeObject(obj: unknown): Record<string, unknown> {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return {};
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      if (typeof value === 'string') {
        result[key] = this.sanitizeString(value);
      } else if (typeof value === 'number') {
        result[key] = this.sanitizeNumber(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof ArrayBuffer)) {
        result[key] = this.sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

/**
 * محدد معدل العمليات (RateLimiter) لحماية الموارد وواجهات التصدير
 */
export class RateLimiter {
  private requests: Map<string, { count: number; lastRequest: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string = 'default-client'): boolean {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now - record.lastRequest > this.windowMs) {
      this.requests.set(key, { count: 1, lastRequest: now });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    this.requests.set(key, { count: record.count + 1, lastRequest: record.lastRequest });
    return true;
  }

  reset(key: string = 'default-client'): void {
    this.requests.delete(key);
  }
}

export const defaultRateLimiter = new RateLimiter(15, 1000);
