import * as THREE from 'three';

/**
 * توليد ملف تعريف المقلاة بدقة عالية
 */
export class PanProfileGenerator {
  /**
   * توليد ملف تعريف المقلاة بدقة عالية
   */
  static generatePanProfile(
    bottomDiameter: number,
    topDiameter: number,
    height: number,
    curveRadius: number,
    profileType: 'curved' | 'straight' = 'curved'
  ): THREE.CatmullRomCurve3 {
    try {
      const controlPoints: THREE.Vector3[] = [];

      if (profileType === 'curved') {
        const rb = bottomDiameter / 2;
        const rt = topDiameter / 2;

        controlPoints.push(new THREE.Vector3(rb, 0, 0));

        const steps = 10;
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const r = rb + (rt - rb) * t;
          const z = height * t;
          
          const curveOffset = Math.sin(t * Math.PI) * curveRadius;
          controlPoints.push(new THREE.Vector3(r + curveOffset, 0, z));
        }

        controlPoints.push(new THREE.Vector3(rt, 0, height));
      } else {
        const rb = bottomDiameter / 2;
        const rt = topDiameter / 2;

        controlPoints.push(new THREE.Vector3(rb, 0, 0));
        controlPoints.push(new THREE.Vector3(rt, 0, height));
      }

      const curve = new THREE.CatmullRomCurve3(controlPoints);
      this.validateCurveAccuracy(curve, controlPoints);

      return curve;
    } catch (error) {
      console.error('خطأ في توليد ملف تعريف المقلاة:', error);
      throw error;
    }
  }

  private static validateCurveAccuracy(
    curve: THREE.CatmullRomCurve3,
    controlPoints: THREE.Vector3[]
  ): void {
    const tolerance = 0.01;
    const points = curve.getPoints(1000);

    for (const point of points) {
      if (point.z < -tolerance || point.z > 100 + tolerance) {
        console.warn(`تحذير: نقطة خارج الحدود: ${point}`);
      }
    }
  }

  static calculateCurvature(
    curve: THREE.CatmullRomCurve3,
    t: number
  ): number {
    const epsilon = 0.0001;
    
    const p1 = curve.getPoint(Math.max(0, t - epsilon));
    const p2 = curve.getPoint(t);
    const p3 = curve.getPoint(Math.min(1, t + epsilon));

    const dp1 = p2.clone().sub(p1);
    const dp2 = p3.clone().sub(p2);

    const d2p = dp2.clone().sub(dp1);

    const curvature = d2p.length() / (dp1.length() * dp1.length());
    return curvature;
  }

  static validateCurvatureChange(
    curve: THREE.CatmullRomCurve3
  ): { isSmooth: boolean; maxChange: number } {
    const samples = 100;
    let maxChange = 0;
    let prevCurvature = 0;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const curvature = this.calculateCurvature(curve, t);

      if (i > 0) {
        const change = Math.abs(curvature - prevCurvature);
        maxChange = Math.max(maxChange, change);
      }

      prevCurvature = curvature;
    }

    return {
      isSmooth: maxChange < 0.1,
      maxChange
    };
  }
}
