import * as THREE from 'three';
import { ErrorHandler } from '../errorHandler';

/**
 * استخراج منحنى السرج (Saddle Curve) من نتيجة Boolean
 * مع ضمان الاستمرارية والدقة
 */
export class SaddleCurveExtractor {
  static extractSaddleCurve(
    csgResult: THREE.Mesh,
    tolerance: number = 0.01
  ): {
    curve: THREE.Vector3[];
    isValid: boolean;
    loops: THREE.Vector3[][];
    primaryLoop: THREE.Vector3[];
  } {
    try {
      const geometry = csgResult.geometry as THREE.BufferGeometry;
      
      // 1. استخراج جميع الحلقات (Loops)
      const allLoops = this.extractAllLoops(geometry, tolerance);
      
      if (allLoops.length === 0) {
        return {
          curve: [],
          isValid: false,
          loops: [],
          primaryLoop: []
        };
      }

      // 2. تحديد الحلقة الأساسية (Primary Loop)
      // الحلقة الأساسية هي تلك التي لها أطول محيط
      const primaryLoop = this.identifyPrimaryLoop(allLoops);
      
      // 3. تنعيم المنحنى
      const smoothedCurve = this.smoothCurve(primaryLoop, tolerance);
      
      // 4. التحقق من الاستمرارية
      const continuityCheck = this.validateContinuity(smoothedCurve, tolerance);

      return {
        curve: smoothedCurve,
        isValid: continuityCheck.isContinuous,
        loops: allLoops,
        primaryLoop
      };
    } catch (error) {
      ErrorHandler.handle(error, 'extractSaddleCurve');
      return {
        curve: [],
        isValid: false,
        loops: [],
        primaryLoop: []
      };
    }
  }

  /**
   * استخراج جميع الحلقات من الهندسة
   */
  private static extractAllLoops(
    geometry: THREE.BufferGeometry,
    tolerance: number
  ): THREE.Vector3[][] {
    const loops: THREE.Vector3[][] = [];
    
    // استخراج الحواف
    const edges = this.extractBoundaryEdges(geometry);
    
    // تجميع الحواف في حلقات
    const visited = new Set<number>();
    
    for (let i = 0; i < edges.length; i++) {
      if (visited.has(i)) continue;

      const loop: THREE.Vector3[] = [];
      let currentEdgeIdx = i;

      while (true) {
        visited.add(currentEdgeIdx);
        const edge = edges[currentEdgeIdx];
        
        loop.push(edge.start);

        // البحث عن الحافة التالية
        let nextEdgeIdx = -1;
        for (let j = 0; j < edges.length; j++) {
          if (visited.has(j)) continue;
          
          if (edges[j].start.distanceTo(edge.end) < tolerance) {
            nextEdgeIdx = j;
            break;
          }
        }

        if (nextEdgeIdx === -1) break;
        currentEdgeIdx = nextEdgeIdx;
      }

      if (loop.length > 3) {
        loops.push(loop);
      }
    }

    return loops;
  }

  /**
   * استخراج حواف الحدود
   */
  private static extractBoundaryEdges(
    geometry: THREE.BufferGeometry
  ): Array<{ start: THREE.Vector3; end: THREE.Vector3 }> {
    const edges: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
    const edgeMap = new Map<string, number>();

    const positions = geometry.attributes.position.array as Float32Array;
    const indices = geometry.index?.array as Uint32Array | Uint16Array | undefined;

    // عد الحواف
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const edges_tri = [
          [i0, i1],
          [i1, i2],
          [i2, i0]
        ];

        for (const [a, b] of edges_tri) {
          const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
          edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
        }
      }
    }

    // احتفظ فقط بالحواف التي تظهر مرة واحدة (حواف الحدود)
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const edges_tri = [
          [i0, i1],
          [i1, i2],
          [i2, i0]
        ];

        for (const [a, b] of edges_tri) {
          const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
          
          if (edgeMap.get(key) === 1) {
            const v0 = new THREE.Vector3(
              positions[a * 3],
              positions[a * 3 + 1],
              positions[a * 3 + 2]
            );
            const v1 = new THREE.Vector3(
              positions[b * 3],
              positions[b * 3 + 1],
              positions[b * 3 + 2]
            );

            edges.push({ start: v0, end: v1 });
          }
        }
      }
    }

    return edges;
  }

  /**
   * تحديد الحلقة الأساسية
   */
  private static identifyPrimaryLoop(
    loops: THREE.Vector3[][]
  ): THREE.Vector3[] {
    if (loops.length === 0) return [];
    if (loops.length === 1) return loops[0];

    // الحلقة الأساسية هي تلك التي لها أطول محيط
    let primaryLoop = loops[0];
    let maxPerimeter = this.calculatePerimeter(loops[0]);

    for (let i = 1; i < loops.length; i++) {
      const perimeter = this.calculatePerimeter(loops[i]);
      if (perimeter > maxPerimeter) {
        maxPerimeter = perimeter;
        primaryLoop = loops[i];
      }
    }

    return primaryLoop;
  }

  /**
   * حساب محيط الحلقة
   */
  private static calculatePerimeter(loop: THREE.Vector3[]): number {
    let perimeter = 0;
    for (let i = 0; i < loop.length; i++) {
      const next = (i + 1) % loop.length;
      perimeter += loop[i].distanceTo(loop[next]);
    }
    return perimeter;
  }

  /**
   * تنعيم المنحنى
   */
  private static smoothCurve(
    curve: THREE.Vector3[],
    tolerance: number
  ): THREE.Vector3[] {
    if (curve.length < 4) return curve;

    const smoothed: THREE.Vector3[] = [];

    for (let i = 0; i < curve.length; i++) {
      const p0 = curve[(i - 1 + curve.length) % curve.length];
      const p1 = curve[i];
      const p2 = curve[(i + 1) % curve.length];
      const p3 = curve[(i + 2) % curve.length];

      // استخدم Catmull-Rom Spline
      const steps = Math.max(1, Math.ceil(p1.distanceTo(p2) / tolerance));
      
      for (let t = 0; t < 1; t += 1 / steps) {
        const point = this.catmullRom(p0, p1, p2, p3, t);
        smoothed.push(point);
      }
    }

    return smoothed;
  }

  /**
   * حساب نقطة Catmull-Rom
   */
  private static catmullRom(
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    t: number
  ): THREE.Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;

    const v0 = (p2.clone().sub(p0)).multiplyScalar(0.5);
    const v1 = (p3.clone().sub(p1)).multiplyScalar(0.5);

    return p1.clone()
      .multiplyScalar(2 * t3 - 3 * t2 + 1)
      .add(v0.multiplyScalar(t3 - 2 * t2 + t))
      .add(p2.clone().multiplyScalar(-2 * t3 + 3 * t2))
      .add(v1.multiplyScalar(t3 - t2));
  }

  /**
   * التحقق من الاستمرارية
   */
  private static validateContinuity(
    curve: THREE.Vector3[],
    tolerance: number
  ): { isContinuous: boolean; maxGap: number } {
    let maxGap = 0;

    for (let i = 0; i < curve.length - 1; i++) {
      const gap = curve[i].distanceTo(curve[i + 1]);
      maxGap = Math.max(maxGap, gap);
    }

    return {
      isContinuous: maxGap < tolerance,
      maxGap
    };
  }
}
