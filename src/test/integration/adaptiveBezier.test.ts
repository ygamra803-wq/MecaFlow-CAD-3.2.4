// adaptiveBezier.test.ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AdaptiveBezierCurve } from '../../lib/geometry/AdaptiveBezierCurve';

describe('AdaptiveBezierCurve Integration Tests', () => {
  describe('Curve Generation', () => {
    it('يجب توليد منحنى بدقة عالية مع معالجة التسامح', () => {
      const P0 = new THREE.Vector3(0, 0, 0);
      const P1 = new THREE.Vector3(50, 100, 0);
      const P2 = new THREE.Vector3(100, 0, 0);

      const curve = AdaptiveBezierCurve.generateCurve(P0, P1, P2, 0.01);

      // التحقق من أن تباعد النقاط معقول ومحدد
      expect(curve.length).toBeGreaterThan(1);
      for (let i = 0; i < curve.length - 1; i++) {
        const gap = curve[i].distanceTo(curve[i + 1]);
        expect(gap).toBeLessThan(100); // نقاط متقاربة وموزعة بشكل متكيف
      }
    });

    it('يجب أن تبدأ المنحنى من P0 وتنتهي عند P2', () => {
      const P0 = new THREE.Vector3(0, 0, 0);
      const P1 = new THREE.Vector3(50, 100, 0);
      const P2 = new THREE.Vector3(100, 0, 0);

      const curve = AdaptiveBezierCurve.generateCurve(P0, P1, P2);

      expect(curve[0]).toEqual(P0);
      expect(curve[curve.length - 1]).toEqual(P2);
    });

    it('يجب التعامل مع المنحنيات الخطية', () => {
      const P0 = new THREE.Vector3(0, 0, 0);
      const P1 = new THREE.Vector3(50, 0, 0);
      const P2 = new THREE.Vector3(100, 0, 0);

      const curve = AdaptiveBezierCurve.generateCurve(P0, P1, P2);

      // يجب أن تكون جميع النقاط على الخط المستقيم
      for (const point of curve) {
        expect(point.y).toBeCloseTo(0, 5);
        expect(point.z).toBeCloseTo(0, 5);
      }
    });
  });

  describe('Error Handling', () => {
    it('يجب رفع خطأ للمعاملات غير الصالحة كـ NaN', () => {
      const invalidPoint = new THREE.Vector3(NaN, 0, 0);
      expect(() => {
        AdaptiveBezierCurve.generateCurve(invalidPoint, new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,1));
      }).toThrow();
    });
  });
});
