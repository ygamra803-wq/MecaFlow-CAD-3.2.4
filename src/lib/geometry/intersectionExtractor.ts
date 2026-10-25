import * as THREE from 'three';

export interface IntersectionValidationResult {
  path: THREE.Vector3[];
  isValid: boolean;
  gaps: number[];
  maxGap: number;
  isContinuous: boolean;
  pointCount: number;
  recommendation: string;
}

/**
 * استخراج خط التقاطع من نتيجة Boolean CSG
 * مع ضمان الاستمرارية والدقة الهندسية
 */
export class IntersectionExtractor {
  private static readonly TOLERANCE = 0.01; // 0.01 ملم
  private static readonly MIN_EDGE_LENGTH = 0.001; // تجاهل الحواف الصغيرة جداً

  /**
   * استخراج خط التقاطع من نتيجة Boolean CSG
   * @param csgResult - نتيجة العملية البوليانية
   * @param tolerance - دقة التسامح (ملم)
   * @returns مسار التقاطع مع معلومات الجودة
   */
  static extractIntersectionPath(
    csgResult: THREE.Mesh,
    tolerance: number = this.TOLERANCE
  ): IntersectionValidationResult {
    try {
      const geometry = csgResult.geometry as THREE.BufferGeometry;
      
      if (!geometry.attributes.position) {
        return this.createEmptyResult('الهندسة لا تحتوي على بيانات موضع');
      }

      // 1. استخراج الحافات من المثلثات
      const edges = this.extractEdges(geometry);
      
      if (edges.length === 0) {
        return this.createEmptyResult('لم يتم العثور على حافات في الهندسة');
      }

      // 2. تصفية الحافات: احتفظ فقط بحافات التقاطع
      const intersectionEdges = this.filterIntersectionEdges(edges, tolerance);
      
      if (intersectionEdges.length === 0) {
        return this.createEmptyResult('لم يتم العثور على حافات تقاطع');
      }

      // 3. ربط الحافات في مسار متصل
      const path = this.connectEdgesIntoPath(intersectionEdges, tolerance);
      
      if (path.length === 0) {
        return this.createEmptyResult('فشل في ربط الحافات في مسار');
      }

      // 4. التحقق من الاستمرارية
      const continuityCheck = this.validateContinuity(path, tolerance);
      
      // 5. تنعيم المسار (اختياري)
      const smoothedPath = this.smoothPath(path, tolerance);

      return {
        path: smoothedPath,
        isValid: continuityCheck.isContinuous && continuityCheck.maxGap < tolerance,
        gaps: continuityCheck.gaps,
        maxGap: continuityCheck.maxGap,
        isContinuous: continuityCheck.isContinuous,
        pointCount: smoothedPath.length,
        recommendation: this.generateRecommendation(continuityCheck, smoothedPath.length)
      };
    } catch (error) {
      console.error('خطأ في استخراج مسار التقاطع:', error);
      return this.createEmptyResult(`خطأ: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  }

  /**
   * استخراج الحافات من المثلثات
   */
  private static extractEdges(
    geometry: THREE.BufferGeometry
  ): Array<{ start: THREE.Vector3; end: THREE.Vector3; triangleIndex: number }> {
    const edges: Array<{ start: THREE.Vector3; end: THREE.Vector3; triangleIndex: number }> = [];
    const positions = geometry.attributes.position.array as Float32Array;
    const indices = geometry.index?.array as Uint32Array | Uint16Array | undefined;

    if (!indices) {
      // إذا لم يكن هناك indices، استخدم positions مباشرة
      for (let i = 0; i < positions.length; i += 9) {
        const v0 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        const v1 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
        const v2 = new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

        edges.push({ start: v0, end: v1, triangleIndex: i / 9 });
        edges.push({ start: v1, end: v2, triangleIndex: i / 9 });
        edges.push({ start: v2, end: v0, triangleIndex: i / 9 });
      }
    } else {
      // استخدم indices
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const v0 = new THREE.Vector3(
          positions[i0 * 3],
          positions[i0 * 3 + 1],
          positions[i0 * 3 + 2]
        );
        const v1 = new THREE.Vector3(
          positions[i1 * 3],
          positions[i1 * 3 + 1],
          positions[i1 * 3 + 2]
        );
        const v2 = new THREE.Vector3(
          positions[i2 * 3],
          positions[i2 * 3 + 1],
          positions[i2 * 3 + 2]
        );

        edges.push({ start: v0, end: v1, triangleIndex: i / 3 });
        edges.push({ start: v1, end: v2, triangleIndex: i / 3 });
        edges.push({ start: v2, end: v0, triangleIndex: i / 3 });
      }
    }

    return edges;
  }

  /**
   * تصفية الحافات: احتفظ فقط بحافات التقاطع (الحافات التي تظهر مرة واحدة فقط)
   */
  private static filterIntersectionEdges(
    edges: Array<{ start: THREE.Vector3; end: THREE.Vector3; triangleIndex: number }>,
    tolerance: number
  ): Array<{ start: THREE.Vector3; end: THREE.Vector3 }> {
    const edgeMap = new Map<string, number>();
    const edgeList = new Map<string, { start: THREE.Vector3; end: THREE.Vector3 }>();

    for (const edge of edges) {
      const key = this.edgeKey(edge.start, edge.end, tolerance);
      const reverseKey = this.edgeKey(edge.end, edge.start, tolerance);

      // تجاهل الحواف الصغيرة جداً
      if (edge.start.distanceTo(edge.end) < this.MIN_EDGE_LENGTH) {
        continue;
      }

      // عد الحافة والعكس
      edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      edgeMap.set(reverseKey, (edgeMap.get(reverseKey) || 0) + 1);

      if (!edgeList.has(key)) {
        edgeList.set(key, { start: edge.start, end: edge.end });
      }
    }

    // احتفظ فقط بالحافات التي تظهر مرة واحدة (حافات الحدود)
    const result: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
    for (const [key, count] of edgeMap.entries()) {
      if (count === 1 && edgeList.has(key)) {
        result.push(edgeList.get(key)!);
      }
    }

    return result;
  }

  /**
   * ربط الحافات في مسار متصل
   */
  private static connectEdgesIntoPath(
    edges: Array<{ start: THREE.Vector3; end: THREE.Vector3 }>,
    tolerance: number
  ): THREE.Vector3[] {
    if (edges.length === 0) return [];

    const path: THREE.Vector3[] = [];
    const remaining = new Set(edges);

    // ابدأ من أول حافة
    let current = edges[0];
    path.push(current.start);
    path.push(current.end);
    remaining.delete(current);

    // ربط الحافات المتتالية
    let iterations = 0;
    const maxIterations = edges.length * 2;

    while (remaining.size > 0 && iterations < maxIterations) {
      iterations++;
      let found = false;

      for (const edge of remaining) {
        const distToStart = edge.start.distanceTo(current.end);
        const distToEnd = edge.end.distanceTo(current.end);

        if (distToStart < tolerance) {
          path.push(edge.end);
          current = edge;
          remaining.delete(edge);
          found = true;
          break;
        } else if (distToEnd < tolerance) {
          path.push(edge.start);
          current = { start: edge.end, end: edge.start };
          remaining.delete(edge);
          found = true;
          break;
        }
      }

      if (!found) {
        console.warn(`تحذير: فجوة في مسار التقاطع - ${remaining.size} حافة متبقية`);
        break;
      }
    }

    return path;
  }

  /**
   * التحقق من الاستمرارية
   */
  private static validateContinuity(
    path: THREE.Vector3[],
    tolerance: number
  ): {
    isContinuous: boolean;
    gaps: number[];
    maxGap: number;
  } {
    const gaps: number[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const gap = path[i].distanceTo(path[i + 1]);
      if (gap > tolerance) {
        gaps.push(gap);
      }
    }

    const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;

    return {
      isContinuous: maxGap < tolerance,
      gaps,
      maxGap
    };
  }

  /**
   * تنعيم المسار باستخدام Catmull-Rom
   */
  private static smoothPath(
    path: THREE.Vector3[],
    tolerance: number
  ): THREE.Vector3[] {
    if (path.length < 4) return path;

    const smoothed: THREE.Vector3[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const p0 = path[Math.max(0, i - 1)];
      const p1 = path[i];
      const p2 = path[i + 1];
      const p3 = path[Math.min(path.length - 1, i + 2)];

      // استخدم Catmull-Rom لإنشاء نقاط وسيطة
      const steps = Math.ceil(p1.distanceTo(p2) / (tolerance / 2));
      
      for (let t = 0; t < 1; t += 1 / Math.max(1, steps)) {
        const point = this.catmullRom(p0, p1, p2, p3, t);
        smoothed.push(point);
      }
    }

    smoothed.push(path[path.length - 1]);
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

    const result = p1.clone()
      .multiplyScalar(2 * t3 - 3 * t2 + 1)
      .add(v0.multiplyScalar(t3 - 2 * t2 + t))
      .add(p2.clone().multiplyScalar(-2 * t3 + 3 * t2))
      .add(v1.multiplyScalar(t3 - t2));

    return result;
  }

  /**
   * إنشاء مفتاح فريد للحافة
   */
  private static edgeKey(
    start: THREE.Vector3,
    end: THREE.Vector3,
    tolerance: number
  ): string {
    const round = (v: number) => Math.round(v / tolerance) * tolerance;
    return `${round(start.x)},${round(start.y)},${round(start.z)}-${round(end.x)},${round(end.y)},${round(end.z)}`;
  }

  /**
   * إنشاء نتيجة فارغة مع رسالة خطأ
   */
  private static createEmptyResult(message: string): IntersectionValidationResult {
    return {
      path: [],
      isValid: false,
      gaps: [],
      maxGap: 0,
      isContinuous: false,
      pointCount: 0,
      recommendation: message
    };
  }

  /**
   * توليد توصية بناءً على نتائج الفحص
   */
  private static generateRecommendation(
    continuityCheck: { isContinuous: boolean; maxGap: number },
    pointCount: number
  ): string {
    if (!continuityCheck.isContinuous) {
      if (continuityCheck.maxGap > 1) {
        return 'تحذير: فجوات كبيرة جداً في مسار التقاطع - يرجى تعديل الزاوية أو الأبعاد';
      } else if (continuityCheck.maxGap > 0.1) {
        return 'تحذير: فجوات متوسطة - قد تؤثر على جودة القطع';
      } else {
        return 'تحذير: فجوات صغيرة - قد تكون مقبولة حسب التسامح';
      }
    }

    if (pointCount < 10) {
      return 'تحذير: عدد نقاط التقاطع قليل جداً - قد تكون الهندسة بسيطة جداً';
    }

    return 'المسار ممتاز - يمكن المتابعة بأمان';
  }
}
