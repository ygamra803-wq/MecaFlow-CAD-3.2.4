import * as THREE from 'three';
import { GeometryData } from '../types';

/**
 * مدير الذاكرة للهندسة ثلاثية الأبعاد
 */
export class GeometryManager {
  private geometries: Map<string, THREE.BufferGeometry> = new Map();
  private materials: Map<string, THREE.Material> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();
  private memoryMonitor: MemoryMonitor;

  constructor() {
    this.memoryMonitor = new MemoryMonitor();
  }

  /**
   * إنشاء هندسة مع تتبع الذاكرة
   */
  createGeometry(id: string, data: GeometryData): THREE.BufferGeometry {
    // تحرير الهندسة القديمة إن وجدت
    this.disposeGeometry(id);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(data.vertices);
    const normals = new Float32Array(data.normals);
    const indices = new Uint32Array(data.indices);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    // تسجيل الهندسة
    this.geometries.set(id, geometry);

    // مراقبة الذاكرة
    this.memoryMonitor.track(id, this.estimateMemory(geometry));

    return geometry;
  }

  /**
   * تحرير هندسة معينة
   */
  disposeGeometry(id: string): void {
    const geometry = this.geometries.get(id);
    
    if (geometry) {
      // تحرير الـ attributes
      if (geometry.attributes.position) {
        geometry.deleteAttribute('position');
      }
      if (geometry.attributes.normal) {
        geometry.deleteAttribute('normal');
      }

      // تحرير الـ index
      if (geometry.index) {
        geometry.index.array = null as any;
      }

      // حذف الهندسة
      geometry.dispose();
      this.geometries.delete(id);

      // تحديث مراقبة الذاكرة
      this.memoryMonitor.untrack(id);
    }
  }

  /**
   * تحرير جميع الموارد
   */
  disposeAll(): void {
    // تحرير الهندسات
    for (const [id] of this.geometries) {
      this.disposeGeometry(id);
    }

    // تحرير المواد
    for (const [id, material] of this.materials) {
      material.dispose();
      this.materials.delete(id);
    }

    // تحرير الـ Textures
    for (const [id, texture] of this.textures) {
      texture.dispose();
      this.textures.delete(id);
    }

    console.log('✅ تم تحرير جميع الموارد');
  }

  /**
   * تقدير استهلاك الذاكرة
   */
  private estimateMemory(geometry: THREE.BufferGeometry): number {
    let memory = 0;

    // حساب حجم الـ attributes
    for (const [key, attribute] of Object.entries(geometry.attributes)) {
      if (attribute instanceof THREE.BufferAttribute) {
        memory += attribute.array.byteLength;
      }
    }

    // حساب حجم الـ index
    if (geometry.index) {
      memory += geometry.index.array.byteLength;
    }

    return memory;
  }

  /**
   * الحصول على إحصائيات الذاكرة
   */
  getMemoryStats(): {
    totalMemory: number;
    geometryCount: number;
    materialCount: number;
    textureCount: number;
  } {
    let totalMemory = 0;

    for (const geometry of this.geometries.values()) {
      totalMemory += this.estimateMemory(geometry);
    }

    return {
      totalMemory,
      geometryCount: this.geometries.size,
      materialCount: this.materials.size,
      textureCount: this.textures.size
    };
  }
}

/**
 * مراقب الذاكرة
 */
class MemoryMonitor {
  private tracked: Map<string, number> = new Map();
  private readonly MAX_MEMORY = 500 * 1024 * 1024; // 500 MB

  track(id: string, memory: number): void {
    this.tracked.set(id, memory);
    this.checkMemoryUsage();
  }

  untrack(id: string): void {
    this.tracked.delete(id);
  }

  private checkMemoryUsage(): void {
    const total = Array.from(this.tracked.values()).reduce((a, b) => a + b, 0);

    if (total > this.MAX_MEMORY) {
      console.warn(
        `⚠️ تحذير: استهلاك الذاكرة مرتفع (${(total / 1024 / 1024).toFixed(2)} MB)`
      );
    }
  }
}
