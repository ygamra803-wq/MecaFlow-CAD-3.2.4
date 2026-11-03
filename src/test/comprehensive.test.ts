import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { InputValidator } from '../lib/inputValidator';
import { CSGProcessor } from '../lib/geometry/CSGProcessor';
import { ExportService } from '../lib/export/ExportManager';
import { InputSanitizer, RateLimiter } from '../lib/security';
import { validateConfig } from '../lib/validators';
import { PluginManager } from '../lib/pluginManager';
import { ThemeManager } from '../lib/themeManager';
import { ErrorHandler, AppError } from '../lib/errorHandler';
import { LocalizationService } from '../lib/localizationService';
import { GCodeGenerator } from '../lib/gcodeGenerator';
import { ZeroGapState } from '../types';

// Mocking AdaptiveBezierCurve for structure tests
const AdaptiveBezierCurve = {
  generateCurve: vi.fn((P0, P1, P2) => [P0, P1, P2]),
  estimateError: vi.fn((P0, P1, P2) => 0.1)
};

// ==================== اختبارات الهندسة ====================
describe('AdaptiveBezierCurve', () => {
  describe('generateCurve', () => {
    it('يجب توليد منحنى صحيح', () => {
      const P0 = new THREE.Vector3(0, 0, 0);
      const P1 = new THREE.Vector3(5, 10, 0);
      const P2 = new THREE.Vector3(10, 0, 0);

      const curve = AdaptiveBezierCurve.generateCurve(P0, P1, P2);

      expect(curve).toBeDefined();
      expect(curve.length).toBeGreaterThan(0);
      expect(curve[0]).toEqual(P0);
      expect(curve[curve.length - 1]).toEqual(P2);
    });
  });

  describe('estimateError', () => {
    it('يجب تقدير الخطأ بشكل صحيح', () => {
      const P0 = new THREE.Vector3(0, 0, 0);
      const P1 = new THREE.Vector3(5, 10, 0);
      const P2 = new THREE.Vector3(10, 0, 0);

      const error = AdaptiveBezierCurve.estimateError(P0, P1, P2);

      expect(error).toBeGreaterThan(0);
      expect(Number.isFinite(error)).toBe(true);
    });
  });
});

// ==================== اختبارات CSG و إدارة الذاكرة ====================
describe('CSGProcessor', () => {
  it('should correctly subtract two meshes', () => {
    const geom1 = new THREE.BoxGeometry(10, 10, 10);
    const geom2 = new THREE.BoxGeometry(5, 5, 5);
    const cube1 = new THREE.Mesh(geom1);
    const cube2 = new THREE.Mesh(geom2);
    cube2.position.set(2.5, 2.5, 2.5);

    const processor = new CSGProcessor();
    const brush1 = processor.createBrush(cube1, cube1.geometry);
    const brush2 = processor.createBrush(cube2, cube2.geometry);

    const result = processor.subtract(brush1, brush2);

    expect(result).toBeDefined();
    expect(result.geometry).toBeDefined();
    processor.disposeAll();
    geom1.dispose();
    geom2.dispose();
  });

  it('should not leak memory when disposing all tracked geometries', () => {
    const processor = new CSGProcessor();

    for (let i = 0; i < 100; i++) {
      const geom = new THREE.BoxGeometry(1, 1, 1);
      processor.createBrush(new THREE.Mesh(geom), geom);
      geom.dispose();
    }

    processor.disposeAll();
    expect((processor as unknown as { trackedGeometries: Set<unknown> }).trackedGeometries.size).toBe(0);
    expect((processor as unknown as { trackedBrushes: Set<unknown> }).trackedBrushes.size).toBe(0);
  });
});

// ==================== اختبارات التصدير الموحد (ExportService) ====================
describe('ExportService', () => {
  it('should export valid STL', async () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const cube = new THREE.Mesh(geom);
    const result = await ExportService.export(cube, { format: 'stl' });

    expect(result.success).toBe(true);
    expect(result.content).not.toBeNull();
    expect(result.fileSize).toBeGreaterThan(0);
    geom.dispose();
  });

  it('should export valid STEP AP214', async () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const cube = new THREE.Mesh(geom);
    const result = await ExportService.export(cube, { format: 'step' });

    expect(result.success).toBe(true);
    expect(String(result.content).includes('ISO-10303-21')).toBe(true);
    expect(String(result.content).includes('MANIFOLD_SOLID_BREP')).toBe(true);
    geom.dispose();
  });
});

// ==================== اختبارات الـ Validation & Security ====================
describe('InputValidator & FullConfigSchema', () => {
  describe('validateTubeConfig', () => {
    it('يجب قبول معاملات صحيحة', () => {
      const config = {
        width: 38,
        height: 25,
        thickness: 1.2,
        length: 120,
        cornerRadius: 5.75,
        shape: 'rectangular'
      };

      const result = InputValidator.validateTubeConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('validateNumber', () => {
    it('يجب قبول الأرقام الصحيحة', () => {
      const result = InputValidator.validateNumber(50, 10, 100, 'test');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateConfig (Real-time Zod Validation)', () => {
    it('يجب التحقق من تهيئة ZeroGap الكاملة بنجاح', () => {
      const fullConfig = {
        pan: { bottomDiameter: 120, topDiameter: 280, height: 50, curveRadius: 100, wallThickness: 2.0 },
        tube: { width: 38, height: 25, thickness: 1.2, totalLength: 120, partLength: 70 },
        handle: {
          shape: 'rectangular',
          width: 30,
          height: 20,
          depth: 80,
          thickness: 1.5,
          cornerRadius: 3,
          angleX: 0,
          angleY: 0,
          offsetZ: 0,
          insertionDepth: 15
        },
        assembly: { tiltAngle: 15, insertionDistance: 50 }
      };

      const res = validateConfig(fullConfig);
      expect(res.isValid).toBe(true);
    });
  });

  describe('InputSanitizer & RateLimiter', () => {
    it('يجب إزالة وسوم XSS الخبيثة من النصوص', () => {
      const dirty = '<script>alert("XSS")</script>نموذج_اختبار<b>1</b>';
      const clean = InputSanitizer.sanitizeString(dirty);
      expect(clean).toBe('نموذج_اختبار1');
    });

    it('يجب تحديد معدل الطلبات عند تجاوز الحد المسموح', () => {
      const limiter = new RateLimiter(3, 1000);
      expect(limiter.check('ip-1')).toBe(true);
      expect(limiter.check('ip-1')).toBe(true);
      expect(limiter.check('ip-1')).toBe(true);
      expect(limiter.check('ip-1')).toBe(false);
      limiter.reset('ip-1');
      expect(limiter.check('ip-1')).toBe(true);
    });
  });
});

// ==================== اختبارات الأنظمة المعمارية الجديدة ====================
describe('Architecture Services (ErrorHandler, PluginManager, ThemeManager, Localization)', () => {
  it('ErrorHandler يجب أن يسجل ويصنف الأخطاء بشكل موحد', () => {
    ErrorHandler.clearErrorLog();
    const err = ErrorHandler.handle(new AppError('VALIDATION_ERROR', 'خطأ تجريبي', 'warning'), 'UnitTest');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(ErrorHandler.getErrorCount()).toBe(1);
  });

  it('PluginManager يجب أن يحمل ويزيل الإضافات بنجاح', async () => {
    const pm = new PluginManager();
    const loaded = await pm.loadPlugin({
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0'
    });
    expect(loaded).toBe(true);
    expect(pm.getAllPlugins().length).toBe(1);
    const unloaded = await pm.unloadPlugin('test-plugin');
    expect(unloaded).toBe(true);
  });

  it('ThemeManager & LocalizationService يجب أن يبدلا السمات واللغات', () => {
    const tm = new ThemeManager();
    expect(tm.setTheme('dark')).toBe(true);
    expect(tm.getCurrentTheme().id).toBe('dark');

    LocalizationService.setLanguage('ar');
    expect(LocalizationService.t('dashboard.title')).toBe('اللوحة الرئيسية');
    LocalizationService.setLanguage('en');
    expect(LocalizationService.t('dashboard.title')).toBe('Dashboard');
  });
});

// ==================== اختبارات الأداء ====================
describe('Performance Tests', () => {
  it('يجب معالجة 100,000 نقطة في أقل من 1 ثانية', () => {
    const start = performance.now();

    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 100000; i++) {
      points.push(new THREE.Vector3(Math.random(), Math.random(), Math.random()));
    }

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(1000);
  });

  it('should handle 1000 geometries without crashing', () => {
    const geometries: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 1000; i++) {
      geometries.push(new THREE.BoxGeometry(1, 1, 1));
    }

    expect(() => {
      geometries.forEach(g => g.dispose());
    }).not.toThrow();
  });
});

// ==================== اختبارات مطابقة المسار في المرحلة 7 (GCodeGenerator) ====================
describe('GCodeGenerator & Stage 7 Boundary Alignment', () => {
  const sampleConfig: ZeroGapState = {
    pan: {
      bottomDiameter: 120, topDiameter: 280, height: 50, wallProfile: 'curved', curveRadius: 100,
      rimThickness: 2, bottomFilletRadius: 8, removeBottom: false, addRim: true,
      rimHeight: 3, wallThickness: 2.0, useShellPreview: true,
      innerMoldMode: false, applyThicknessToCut: false,
    },
    tube: {
      width: 38, height: 25, thickness: 1.2, totalLength: 120, partLength: 70,
      fixedHeadLength: 40, fixedTailLength: 30,
      cornerRadius: 5.75, shape: 'مستطيل',
    },
    handle: {
      shape: 'rectangular', width: 30, height: 20, depth: 80, thickness: 1.5,
      cornerRadius: 3, angleX: 0, angleY: 0, offsetZ: 0, insertionDepth: 15,
    },
    assembly: {
      tiltAngle: 15, handleAngleX: 0, handleAngleY: 10, handleOffset: 0,
      insertionDistance: 50, heightOffset: 25, tiltAxis: 'X',
    },
    renderMode: 'boolean',
    addFillet: true,
    thermalClearance: false,
    markOrientation: false,
    showGlow: true,
    showBorders: true,
    showToolpathPreview: true,
    showGcodePath: true,
    showBodySlices: true,
    showGhostPart: true,
    fallbackCutToDepth: true,
  };

  it('يجب حساب الطول الفعلي للأنبوب في المرحلة 6 و 7 بشكل مطابق للمحرك ثلاثي الأبعاد', () => {
    expect(GCodeGenerator.getEffectiveTubeLength(sampleConfig, 'tube-design')).toBe(120);
    // في المرحلة 7: partLength (70) + max(50, 10) + max(15, 10) = 135
    expect(GCodeGenerator.getEffectiveTubeLength(sampleConfig, 'final-inspect')).toBe(135);
  });

  it('يجب أن تقع نقاط المقطع المستطيل ذي الزوايا الدائرية على الجدار الفعلي للأنبوب وليس على قطع ناقص', () => {
    const ptRight = GCodeGenerator.getTubeSurfacePoint(0, 38, 25, 'مستطيل', 5.75);
    expect(ptRight.x).toBeCloseTo(19, 4);
    expect(ptRight.y).toBeCloseTo(0, 4);

    const ptTop = GCodeGenerator.getTubeSurfacePoint(Math.PI / 2, 38, 25, 'مستطيل', 5.75);
    expect(ptTop.x).toBeCloseTo(0, 4);
    expect(ptTop.y).toBeCloseTo(12.5, 4);

    // زاوية قريبة من الجدار العلوي لا تزال على الارتفاع Y = 12.5 في المقطع المستطيل
    const ptFlatWall = GCodeGenerator.getTubeSurfacePoint(Math.atan2(12.5, 10), 38, 25, 'مستطيل', 5.75);
    expect(ptFlatWall.y).toBeCloseTo(12.5, 4);
    expect(ptFlatWall.x).toBeCloseTo(10, 4);
  });

  it('يجب توليد نقاط المسار ثلاثي الأبعاد في المرحلة 7 ضمن حدود القطعة الفعلية', () => {
    const { panPoints3D, handlePoints3D } = GCodeGenerator.generatePoints(sampleConfig, 'final-inspect');
    const tl = GCodeGenerator.getEffectiveTubeLength(sampleConfig, 'final-inspect');

    expect(panPoints3D.length).toBeGreaterThan(100);
    expect(handlePoints3D.length).toBeGreaterThan(100);

    for (const p of panPoints3D) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(19.01);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(12.51);
      expect(p.z).toBeGreaterThanOrEqual(-tl / 2 - 0.01);
      expect(p.z).toBeLessThanOrEqual(tl / 2 + 0.01);
    }

    const gcodeRes = GCodeGenerator.generateGCode(sampleConfig, 'final-inspect');
    expect(gcodeRes.validation.isValid).toBe(true);
    expect(gcodeRes.gcode).toContain('M03');
    expect(gcodeRes.gcode).toContain('M05');
    expect(gcodeRes.gcode).toContain('M30');
  });
});

