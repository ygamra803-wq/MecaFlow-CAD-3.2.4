import { errorLogger, ErrorSeverity } from './errorLogger';

export interface PerformanceMetrics {
  fps: number;
  memoryUsed: number;
  geometryUpdateTime: number;
  renderTime: number;
  timestamp: string;
}

export class PerformanceOptimizer {
  private metrics: PerformanceMetrics[] = [];
  private frameCount = 0;
  private lastTime = typeof performance !== 'undefined' ? performance.now() : 0;
  private fps = 60;
  private geometryUpdateCache = new Map();
  private debounceTimers = new Map();
  private webGLMetrics = { geometries: 0, textures: 0, calls: 0, triangles: 0 };

  measureFPS(): number {
    if (typeof performance === 'undefined') return 60;
    
    this.frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;

    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime = currentTime;

      if (this.fps < 30) {
        errorLogger.logError(
          `Low FPS detected: ${this.fps}`,
          ErrorSeverity.MEDIUM,
          { fps: this.fps }
        );
      }
    }

    return this.fps;
  }

  updateWebGLMetrics(info: any) {
    this.webGLMetrics = {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      calls: info.render.calls,
      triangles: info.render.triangles,
    };
  }

  getWebGLMetrics() {
    return this.webGLMetrics;
  }

  debounceGeometryUpdate(
    key: string,
    callback: () => void,
    delay: number = 300
  ) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    const timer = setTimeout(() => {
      const startTime = performance.now();
      callback();
      const updateTime = performance.now() - startTime;

      if (updateTime > 150) {
        errorLogger.logError(
          `Slow geometry update: ${updateTime}ms`,
          ErrorSeverity.LOW,
          { key, updateTime }
        );
      }

      this.debounceTimers.delete(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  cacheGeometryCalculation(key: string, calculator: () => any): any {
    if (this.geometryUpdateCache.has(key)) {
      return this.geometryUpdateCache.get(key);
    }

    const result = calculator();
    this.geometryUpdateCache.set(key, result);
    return result;
  }

  clearCache() {
    this.geometryUpdateCache.clear();
  }

  getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return Math.round((performance as any).memory.usedJSHeapSize / 1048576);
    }
    return 0;
  }
}

export const performanceOptimizer = new PerformanceOptimizer();
