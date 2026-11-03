import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION } from 'three-bvh-csg';

/**
 * محرك معالجة العمليات البوليانية (CSGProcessor)
 * يدير عمليات الطرح والتقاطع والدمج الهندسي مع تتبع صارم للذاكرة لمنع تسرب موارد WebGL.
 */
export class CSGProcessor {
  private evaluator = new Evaluator();
  private trackedBrushes: Set<Brush> = new Set();
  private trackedGeometries: Set<THREE.BufferGeometry> = new Set();

  /**
   * إنشاء Brush هندسي مهيأ بالمصفوفة العالمية مع تتبع تلقائي للذاكرة
   */
  createBrush(mesh: THREE.Object3D, geom: THREE.BufferGeometry): Brush {
    const clonedGeom = geom.clone();
    this.trackedGeometries.add(clonedGeom);

    const brush = new Brush(clonedGeom);
    this.trackedBrushes.add(brush);

    mesh.updateMatrixWorld(true);
    mesh.getWorldPosition(brush.position);
    mesh.getWorldQuaternion(brush.quaternion);
    mesh.getWorldScale(brush.scale);
    brush.updateMatrixWorld(true);
    return brush;
  }

  /**
   * طرح هندسي (Target - Tool)
   */
  subtract(target: Brush, tool: Brush): Brush {
    const result = this.evaluator.evaluate(target, tool, SUBTRACTION);
    if (result) {
      this.trackedBrushes.add(result);
      if (result.geometry) {
        this.trackedGeometries.add(result.geometry);
      }
    }
    return result;
  }

  /**
   * تقاطع هندسي (Target ∩ Tool)
   */
  intersect(target: Brush, tool: Brush): Brush {
    const result = this.evaluator.evaluate(target, tool, INTERSECTION);
    if (result) {
      this.trackedBrushes.add(result);
      if (result.geometry) {
        this.trackedGeometries.add(result.geometry);
      }
    }
    return result;
  }

  /**
   * دمج هندسي (Target ∪ Tool)
   */
  union(target: Brush, tool: Brush): Brush {
    const result = this.evaluator.evaluate(target, tool, ADDITION);
    if (result) {
      this.trackedBrushes.add(result);
      if (result.geometry) {
        this.trackedGeometries.add(result.geometry);
      }
    }
    return result;
  }

  /**
   * التخلص من كافة المجسمات والفرش المؤقتة باستثناء المحتفظ بها في المشهد النشط
   */
  clearAllTracked(keepGeometries: (THREE.BufferGeometry | undefined | null)[] = []): void {
    const keepSet = new Set<THREE.BufferGeometry>();
    for (const geom of keepGeometries) {
      if (geom) keepSet.add(geom);
    }

    for (const geom of this.trackedGeometries) {
      if (!keepSet.has(geom)) {
        if (typeof (geom as unknown as { disposeBoundsTree?: () => void }).disposeBoundsTree === 'function') {
          (geom as unknown as { disposeBoundsTree: () => void }).disposeBoundsTree();
        }
        geom.dispose();
      }
    }
    this.trackedGeometries.clear();

    for (const geom of keepSet) {
      this.trackedGeometries.add(geom);
    }

    for (const brush of this.trackedBrushes) {
      if (brush.geometry && !keepSet.has(brush.geometry)) {
        if (typeof (brush.geometry as unknown as { disposeBoundsTree?: () => void }).disposeBoundsTree === 'function') {
          (brush.geometry as unknown as { disposeBoundsTree: () => void }).disposeBoundsTree();
        }
        brush.geometry.dispose();
      }
      if (brush.material) {
        if (Array.isArray(brush.material)) {
          brush.material.forEach(m => m.dispose());
        } else {
          brush.material.dispose();
        }
      }
    }
    this.trackedBrushes.clear();
  }

  /**
   * تنظيف فوري لكافة الموارد غير المستخدمة
   */
  cleanupUnused(): void {
    this.clearAllTracked([]);
  }

  /**
   * إعادة تعيين شاملة للمقيم الهندسي وتحرير الذاكرة بالكامل
   */
  disposeAll(): void {
    this.clearAllTracked([]);
    this.evaluator = new Evaluator();
  }
}
