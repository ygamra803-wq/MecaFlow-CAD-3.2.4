// CSGProcessor.ts
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';

export class CSGProcessor {
  private evaluator = new Evaluator();
  private trackedBrushes: Set<Brush> = new Set();
  private trackedGeometries: Set<THREE.BufferGeometry> = new Set();

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
   * Disposes of all tracked brushes and geometries except those passed in the keepGeometries list.
   * This ensures that intermediate CSG nodes are immediately cleared from GPU/CPU memory.
   */
  clearAllTracked(keepGeometries: (THREE.BufferGeometry | undefined | null)[] = []): void {
    const keepSet = new Set<THREE.BufferGeometry>();
    for (const geom of keepGeometries) {
      if (geom) keepSet.add(geom);
    }

    // Dispose geometries
    for (const geom of this.trackedGeometries) {
      if (!keepSet.has(geom)) {
        geom.dispose();
      }
    }
    this.trackedGeometries.clear();

    // Re-register kept geometries for next run
    for (const geom of keepSet) {
      this.trackedGeometries.add(geom);
    }

    // Dispose brushes and their materials
    for (const brush of this.trackedBrushes) {
      if (brush.geometry && !keepSet.has(brush.geometry)) {
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

    // Reset evaluator cache if possible
    try {
      if (this.evaluator && typeof (this.evaluator as any).clearCache === 'function') {
        (this.evaluator as any).clearCache();
      }
    } catch (e) {
      // safe fallback
    }
  }

  /**
   * Absolute hard manual reset of evaluator and clear everything
   */
  disposeAll(): void {
    this.clearAllTracked([]);
    this.evaluator = new Evaluator();
  }
}

