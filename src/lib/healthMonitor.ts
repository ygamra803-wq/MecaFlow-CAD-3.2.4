export interface HealthStatus {
  healthy: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * نظام فحص ومراقبة صحة التطبيق (HealthMonitor)
 * يراقب استهلاك الذاكرة وحالة WebGL والتخزين المحلي.
 */
export class HealthMonitor {
  private static checks: Map<string, () => Promise<HealthStatus>> = new Map();
  private static interval: ReturnType<typeof setInterval> | null = null;
  private static lastReport: Record<string, HealthStatus> = {};

  static registerCheck(name: string, check: () => Promise<HealthStatus>): void {
    this.checks.set(name, check);
  }

  static async runChecks(): Promise<Record<string, HealthStatus>> {
    const results: Record<string, HealthStatus> = {};

    for (const [name, check] of this.checks.entries()) {
      try {
        results[name] = await check();
      } catch (error) {
        results[name] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    this.lastReport = results;
    return results;
  }

  static startMonitoring(intervalMs: number = 60000): void {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.interval = setInterval(async () => {
      await this.runChecks();
    }, intervalMs);
  }

  static stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  static getLastReport(): Record<string, HealthStatus> {
    return { ...this.lastReport };
  }
}

// تسجيل فحوصات النظام الافتراضية
HealthMonitor.registerCheck('memory', async () => {
  if (typeof performance !== 'undefined' && (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory) {
    const memory = (performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    return {
      healthy: memory.usedJSHeapSize < memory.jsHeapSizeLimit * 0.9,
      details: {
        used: memory.usedJSHeapSize,
        limit: memory.jsHeapSizeLimit
      }
    };
  }
  return { healthy: true };
});

HealthMonitor.registerCheck('webgl', async () => {
  if (typeof document === 'undefined') return { healthy: true };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const healthy = !!gl;
    if (gl && 'getExtension' in gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    return { healthy };
  } catch {
    return { healthy: false, error: 'WebGL not available' };
  }
});
