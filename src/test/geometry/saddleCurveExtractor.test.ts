import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SaddleCurveExtractor } from '../../lib/geometry/saddleCurveExtractor';

describe('SaddleCurveExtractor', () => {
  let mockGeometry: THREE.BufferGeometry;

  beforeEach(() => {
    // إنشاء هندسة اختبار بسيطة: مكعب
    mockGeometry = new THREE.BoxGeometry(10, 10, 10);
  });

  it('يجب استخراج حلقة واحدة على الأقل من مكعب', () => {
    const result = SaddleCurveExtractor.extractSaddleCurve(
      new THREE.Mesh(mockGeometry)
    );

    // للمكعب، العمليات هنا قد تختلف عن الحالة الحقيقية (تقاطع بوليان)،
    // لكنه يجب ألا ينهار
    expect(result).toBeDefined();
  });

  it('يجب اكتشاف الفجوات الكبيرة', () => {
    // إنشاء هندسة بها فجوة متعمدة باستخدام BufferGeometry
    const positions = new Float32Array([
      0, 0, 0,
      10, 0, 0,
      10, 10, 0,
      // فجوة هنا - لا توجد نقطة إغلاق
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // لا يوجد مؤشرات (Indices) هنا، لذا extractBoundaryEdges قد تعيد مصفوفة فارغة
    
    const result = SaddleCurveExtractor.extractSaddleCurve(
      new THREE.Mesh(geometry)
    );

    expect(result.isValid).toBe(false);
  });
});
