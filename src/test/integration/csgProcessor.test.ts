// csgProcessor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CSGProcessor } from '../../lib/geometry/CSGProcessor';

describe('CSGProcessor Integration Tests', () => {
  let processor: CSGProcessor;

  beforeEach(() => {
    processor = new CSGProcessor();
  });

  describe('Boolean Operations', () => {
    it('يجب طرح المقلاة من الأنبوب بشكل صحيح', () => {
      // إنشاء هندسات اختبار
      const tubeGeometry = new THREE.BoxGeometry(38, 25, 120);
      const panGeometry = new THREE.CylinderGeometry(140, 60, 50, 32);

      const targetMesh = new THREE.Mesh(tubeGeometry);
      const toolMesh = new THREE.Mesh(panGeometry);

      // إنشاء Brushes
      const targetBrush = processor.createBrush(targetMesh, tubeGeometry);
      const toolBrush = processor.createBrush(toolMesh, panGeometry);

      // تنفيذ العملية
      const result = processor.subtract(targetBrush, toolBrush);

      // التحقق
      expect(result).toBeDefined();
      expect(result!.geometry).toBeDefined();
      expect(result!.geometry!.attributes.position).toBeDefined();
      expect(result!.geometry!.attributes.position.array.length).toBeGreaterThan(0);
    });

    it('يجب حساب التقاطع بشكل صحيح', () => {
      const tubeGeometry = new THREE.BoxGeometry(38, 25, 120);
      const panGeometry = new THREE.CylinderGeometry(140, 60, 50, 32);

      const targetMesh = new THREE.Mesh(tubeGeometry);
      const toolMesh = new THREE.Mesh(panGeometry);

      const targetBrush = processor.createBrush(targetMesh, tubeGeometry);
      const toolBrush = processor.createBrush(toolMesh, panGeometry);

      const result = processor.intersect(targetBrush, toolBrush);

      expect(result).toBeDefined();
      expect(result!.geometry).toBeDefined();
      expect(result!.geometry!.attributes.position.array.length).toBeGreaterThan(0);
    });

    it('يجب تنظيف الموارد بعد العملية', () => {
      const tubeGeometry = new THREE.BoxGeometry(38, 25, 120);
      const panGeometry = new THREE.CylinderGeometry(140, 60, 50, 32);

      const targetMesh = new THREE.Mesh(tubeGeometry);
      const toolMesh = new THREE.Mesh(panGeometry);

      const targetBrush = processor.createBrush(targetMesh, tubeGeometry);
      const toolBrush = processor.createBrush(toolMesh, panGeometry);

      processor.subtract(targetBrush, toolBrush);
      processor.disposeAll();

      // التحقق من تصفير الذاكرة وتسهيل جمع القمامة
      expect((processor as any).trackedBrushes.size).toBe(0);
      expect((processor as any).trackedGeometries.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('يجب رفع خطأ أو معالجة المدخلات غير الصالحة', () => {
      expect(() => {
        processor.createBrush(null as any, null as any);
      }).toThrow();
    });
  });

  describe('Performance', () => {
    it('يجب معالجة العمليات البوليانية البسيطة بسرعة فائقة', () => {
      const start = performance.now();

      const tubeGeometry = new THREE.BoxGeometry(10, 10, 10);
      const panGeometry = new THREE.BoxGeometry(5, 5, 5);
      const targetMesh = new THREE.Mesh(tubeGeometry);
      const toolMesh = new THREE.Mesh(panGeometry);

      const targetBrush = processor.createBrush(targetMesh, tubeGeometry);
      const toolBrush = processor.createBrush(toolMesh, panGeometry);

      processor.subtract(targetBrush, toolBrush);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1500); // Less than 1.5 seconds is great for modern three-bvh-csg
    });
  });
});
