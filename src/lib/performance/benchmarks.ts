// benchmarks.ts
import * as THREE from 'three';
import { AdaptiveBezierCurve } from '../geometry/AdaptiveBezierCurve';
import { CSGProcessor } from '../geometry/CSGProcessor';
import { IntersectionExtractor } from '../geometry/intersectionExtractor';
import { GCodeGenerator } from '../gcodeGenerator';
import { ZeroGapState } from '../../types';

export interface BenchmarkResult {
  name: string;
  iterations?: number;
  totalTime?: number;
  avgTime?: number;
  initialMemory?: number;
  peakMemory?: number;
  finalMemory?: number;
  status: '✅ PASS' | '❌ FAIL';
}

export class PerformanceBenchmark {
  private static results: BenchmarkResult[] = [];

  static async runBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🚀 بدء اختبارات الأداء...');
    this.results = [];

    // 1. اختبار توليد المنحنى
    try {
      await this.benchmarkBezierGeneration();
    } catch (e) {
      console.error(e);
      this.results.push({ name: 'Bezier Curve Generation', status: '❌ FAIL' });
    }

    // 2. اختبار العمليات البوليانية
    try {
      await this.benchmarkCSGOperations();
    } catch (e) {
      console.error(e);
      this.results.push({ name: 'CSG Subtraction', status: '❌ FAIL' });
    }

    // 3. اختبار استخراج المسار
    try {
      await this.benchmarkPathExtraction();
    } catch (e) {
      console.error(e);
      this.results.push({ name: 'Path Extraction', status: '❌ FAIL' });
    }

    // 4. اختبار توليد G-Code
    try {
      await this.benchmarkGCodeGeneration();
    } catch (e) {
      console.error(e);
      this.results.push({ name: 'G-Code Generation', status: '❌ FAIL' });
    }

    // 5. اختبار استهلاك الذاكرة
    try {
      await this.benchmarkMemoryUsage();
    } catch (e) {
      console.error(e);
      this.results.push({ name: 'Memory Management', status: '❌ FAIL' });
    }

    this.printResults();
    return this.results;
  }

  private static async benchmarkBezierGeneration(): Promise<void> {
    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const P0 = new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0);
      const P1 = new THREE.Vector3(50 + Math.random() * 10, 100 + Math.random() * 10, 0);
      const P2 = new THREE.Vector3(100 + Math.random() * 10, Math.random() * 10, 0);

      AdaptiveBezierCurve.generateCurve(P0, P1, P2);
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    this.results.push({
      name: 'Bezier Curve Generation',
      iterations,
      totalTime: duration,
      avgTime,
      status: avgTime < 5 ? '✅ PASS' : '❌ FAIL'
    });
  }

  private static async benchmarkCSGOperations(): Promise<void> {
    const iterations = 10;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const tubeGeom = new THREE.BoxGeometry(38, 25, 120);
      const panGeom = new THREE.CylinderGeometry(140, 60, 50, 32);

      const processor = new CSGProcessor();
      const targetMesh = new THREE.Mesh(tubeGeom);
      const toolMesh = new THREE.Mesh(panGeom);

      const targetBrush = processor.createBrush(targetMesh, tubeGeom);
      const toolBrush = processor.createBrush(toolMesh, panGeom);

      processor.subtract(targetBrush, toolBrush);
      processor.disposeAll();
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    this.results.push({
      name: 'CSG Subtraction',
      iterations,
      totalTime: duration,
      avgTime,
      status: avgTime < 1000 ? '✅ PASS' : '❌ FAIL'
    });
  }

  private static async benchmarkPathExtraction(): Promise<void> {
    const iterations = 10;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const geometry = new THREE.BoxGeometry(100, 100, 100);
      const mesh = new THREE.Mesh(geometry);

      IntersectionExtractor.extractIntersectionPath(mesh);
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    this.results.push({
      name: 'Path Extraction',
      iterations,
      totalTime: duration,
      avgTime,
      status: avgTime < 1000 ? '✅ PASS' : '❌ FAIL'
    });
  }

  private static async benchmarkGCodeGeneration(): Promise<void> {
    const iterations = 50;
    const start = performance.now();

    const mockState: ZeroGapState = {
      pan: {
        bottomDiameter: 120,
        topDiameter: 280,
        height: 50,
        wallProfile: 'straight',
        curveRadius: 0,
        rimThickness: 2,
        bottomFilletRadius: 0,
        addRim: true,
        rimHeight: 2,
        wallThickness: 2,
        useShellPreview: true,
        innerMoldMode: false,
        applyThicknessToCut: true
      },
      tube: {
        width: 38,
        height: 25,
        thickness: 1.2,
        totalLength: 120,
        fixedHeadLength: 15,
        fixedTailLength: 15,
        partLength: 90,
        cornerRadius: 3,
        shape: 'مستطيل'
      },
      handle: {
        shape: 'rectangular',
        width: 30,
        height: 20,
        depth: 80,
        thickness: 1.5,
        cornerRadius: 3,
        solid: false,
        angleX: 15,
        angleY: 0,
        offsetZ: 0,
        insertionDepth: 15
      },
      assembly: {
        tiltAngle: 15,
        handleAngleX: 0,
        handleAngleY: 0,
        handleOffset: 0,
        insertionDistance: 10,
        heightOffset: 0,
        tiltAxis: 'X'
      },
      renderMode: 'preview',
      addFillet: false,
      thermalClearance: false,
      markOrientation: false,
      showGlow: false,
      showBorders: false,
      showGhostPart: false,
      showToolpathPreview: false,
      showBodySlices: false,
      fallbackCutToDepth: true
    };

    for (let i = 0; i < iterations; i++) {
      GCodeGenerator.generateGCode(mockState, 'final-inspect', {
        feedRate: 1500,
        spindleSpeed: 8000,
        safetyHeight: 5
      });
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    this.results.push({
      name: 'G-Code Generation',
      iterations,
      totalTime: duration,
      avgTime,
      status: avgTime < 100 ? '✅ PASS' : '❌ FAIL'
    });
  }

  private static async benchmarkMemoryUsage(): Promise<void> {
    const memoryAPI = (performance as any).memory;
    const initialMemory = memoryAPI ? memoryAPI.usedJSHeapSize : 0;

    // إنشاء هندسات كثيرة للتجربة
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 500; i++) {
      geometries.push(new THREE.BoxGeometry(10, 10, 10));
    }

    const peakMemory = memoryAPI ? memoryAPI.usedJSHeapSize : 0;

    // تنظيف
    geometries.forEach(g => g.dispose());

    const finalMemory = memoryAPI ? memoryAPI.usedJSHeapSize : 0;

    this.results.push({
      name: 'Memory Management',
      initialMemory: initialMemory / 1024 / 1024,
      peakMemory: peakMemory / 1024 / 1024,
      finalMemory: finalMemory / 1024 / 1024,
      status: !memoryAPI || (finalMemory - initialMemory) < 50 * 1024 * 1024 ? '✅ PASS' : '❌ FAIL'
    });
  }

  private static printResults(): void {
    console.log('\n📊 نتائج اختبارات الأداء:');
    console.log('═'.repeat(80));

    for (const result of this.results) {
      console.log(`\n${result.name}`);
      console.log(`  الحالة: ${result.status}`);
      if (result.iterations) console.log(`  التكرارات: ${result.iterations}`);
      if (result.totalTime) console.log(`  الوقت الإجمالي: ${result.totalTime.toFixed(2)} ms`);
      if (result.avgTime) console.log(`  المتوسط: ${result.avgTime.toFixed(2)} ms`);
      if (result.initialMemory !== undefined) {
        console.log(`  الذاكرة الابتدائية: ${result.initialMemory.toFixed(2)} MB`);
        console.log(`  الذاكرة القصوى: ${result.peakMemory?.toFixed(2)} MB`);
        console.log(`  الذاكرة النهائية: ${result.finalMemory?.toFixed(2)} MB`);
      }
    }

    console.log('\n' + '═'.repeat(80));
  }
}
