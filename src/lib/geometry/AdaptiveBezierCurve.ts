import * as THREE from 'three';

export class AdaptiveBezierCurve {
  private static readonly TOLERANCE = 0.001; // 0.001 ملم
  private static readonly MAX_ITERATIONS = 100;

  /**
   * توليد منحنى Bezier مع ضمان الدقة
   */
  static generateCurve(
    P0: THREE.Vector3,
    P1: THREE.Vector3,
    P2: THREE.Vector3,
    tolerance: number = this.TOLERANCE
  ): THREE.Vector3[] {
    try {
      // 1. التحقق من المدخلات
      if (!this.validatePoints([P0, P1, P2])) {
        throw new Error('نقاط التحكم غير صحيحة');
      }

      // 2. حساب الخطأ المقدر
      const estimatedError = this.estimateError(P0, P1, P2);
      
      if (estimatedError > tolerance * 10) {
        console.warn(`⚠️ تحذير: الخطأ المقدر (${estimatedError.toFixed(4)}ملم) كبير جداً`);
      }

      // 3. توليد النقاط مع تكيف ديناميكي
      const points: THREE.Vector3[] = [];
      const segments = this.calculateOptimalSegments(P0, P1, P2, tolerance);

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const point = this.evaluateBezier(P0, P1, P2, t);
        points.push(point);
      }

      // 4. تحسين النقاط
      const optimizedPoints = this.optimizePoints(points, tolerance);

      // 5. التحقق من الاستمرارية
      this.validateContinuity(optimizedPoints, tolerance);

      return optimizedPoints;
    } catch (error) {
      console.error('❌ خطأ في توليد منحنى Bezier:', error);
      throw error;
    }
  }

  /**
   * تقدير الخطأ في المنحنى
   */
  private static estimateError(
    P0: THREE.Vector3,
    P1: THREE.Vector3,
    P2: THREE.Vector3
  ): number {
    // حساب المسافة من النقطة الوسطية إلى الخط المستقيم
    const midPoint = this.evaluateBezier(P0, P1, P2, 0.5);
    const linePoint = P0.clone().lerp(P2, 0.5);
    
    return midPoint.distanceTo(linePoint);
  }

  /**
   * حساب عدد القطاعات الأمثل
   */
  private static calculateOptimalSegments(
    P0: THREE.Vector3,
    P1: THREE.Vector3,
    P2: THREE.Vector3,
    tolerance: number
  ): number {
    const error = this.estimateError(P0, P1, P2);
    
    if (error < tolerance) {
      return 1; // قطعة واحدة كافية
    }

    // حساب عدد القطاعات المطلوبة
    const segments = Math.ceil(Math.sqrt(error / tolerance));
    return Math.min(segments, 100); // حد أقصى 100 قطعة
  }

  /**
   * تقييم نقطة على منحنى Bezier
   */
  private static evaluateBezier(
    P0: THREE.Vector3,
    P1: THREE.Vector3,
    P2: THREE.Vector3,
    t: number
  ): THREE.Vector3 {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const a = mt2;
    const b = 2 * mt * t;
    const c = t2;

    return P0.clone()
      .multiplyScalar(a)
      .add(P1.clone().multiplyScalar(b))
      .add(P2.clone().multiplyScalar(c));
  }

  /**
   * تحسين النقاط بإزالة النقاط المتقاربة
   */
  private static optimizePoints(
    points: THREE.Vector3[],
    tolerance: number
  ): THREE.Vector3[] {
    const optimized: THREE.Vector3[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
      const lastPoint = optimized[optimized.length - 1];
      const distance = lastPoint.distanceTo(points[i]);

      if (distance > tolerance) {
        optimized.push(points[i]);
      }
    }

    return optimized;
  }

  /**
   * التحقق من الاستمرارية
   */
  private static validateContinuity(
    points: THREE.Vector3[],
    tolerance: number
  ): void {
    for (let i = 0; i < points.length - 1; i++) {
      const gap = points[i].distanceTo(points[i + 1]);
      
      if (gap > tolerance * 10) {
        console.warn(`⚠️ فجوة كبيرة عند النقطة ${i}: ${gap.toFixed(4)}ملم`);
      }
    }
  }

  /**
   * التحقق من صحة النقاط
   */
  private static validatePoints(points: THREE.Vector3[]): boolean {
    for (const point of points) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
        return false;
      }
    }
    return true;
  }
}
