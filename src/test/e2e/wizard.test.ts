// wizard.test.ts
import { describe, it, expect } from 'vitest';
import { ConfigValidator } from '../../lib/validators/schemas';
import { GCodeGenerator } from '../../lib/gcodeGenerator';
import { ZeroGapState } from '../../types';

describe('Wizard E2E Conception-to-Manufacturing Cycles', () => {
  it('يجب إكمال دورة التصميم والتحقق وصناعة الـ G-Code كاملة بنجاح', () => {
    // 1. تهيئة معاملة تصميم الأنبوب
    const tubeConfig = {
      width: 38,
      height: 25,
      thickness: 1.2,
      length: 120, // mapping totalLength
      cornerRadius: 3
    };
    const tubeValidation = ConfigValidator.validateTube(tubeConfig);
    expect(tubeValidation.success).toBe(true);

    // 2. تهيئة معاملة تصميم المقلاة بالتقعير المناسب
    const panConfig = {
      bottomDiameter: 120,
      topDiameter: 280,
      height: 50,
      wallThickness: 2.0
    };
    const panValidation = ConfigValidator.validatePan(panConfig);
    expect(panValidation.success).toBe(true);

    // 3. تهيئة زوايا واتصال المجمع
    const assemblyConfig = {
      tiltAngle: 15,
      handleAngleY: 0
    };
    const assemblyValidation = ConfigValidator.validateAssembly(assemblyConfig);
    expect(assemblyValidation.success).toBe(true);

    // 4. دمج وحساب المعاملات التراكمية في ZeroGapState
    const fullState: ZeroGapState = {
      pan: {
        bottomDiameter: panConfig.bottomDiameter,
        topDiameter: panConfig.topDiameter,
        height: panConfig.height,
        wallThickness: panConfig.wallThickness,
        wallProfile: 'straight',
        curveRadius: 0,
        rimThickness: 2,
        bottomFilletRadius: 0,
        addRim: true,
        rimHeight: 2,
        useShellPreview: true,
        innerMoldMode: false,
        applyThicknessToCut: true
      },
      tube: {
        width: tubeConfig.width,
        height: tubeConfig.height,
        thickness: tubeConfig.thickness,
        totalLength: tubeConfig.length,
        fixedHeadLength: 15,
        fixedTailLength: 15,
        partLength: 90,
        cornerRadius: tubeConfig.cornerRadius,
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
        tiltAngle: assemblyConfig.tiltAngle,
        handleAngleX: 0,
        handleAngleY: assemblyConfig.handleAngleY,
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
      fallbackCutToDepth: true
    };

    // 5. محرك صناعة G-Code متعدد المحاور للماكينات CNC
    const gcodeResult = GCodeGenerator.generateGCode(fullState, 'final-inspect', {
      feedRate: 1500,
      spindleSpeed: 8000,
      safetyHeight: 5
    });

    expect(gcodeResult.gcode).toBeDefined();
    expect(gcodeResult.validation.isValid).toBe(true);
    expect(gcodeResult.gcode.includes('M03')).toBe(true); // ليزر يعمل
    expect(gcodeResult.gcode.includes('M30')).toBe(true); // انتهاء البرنامج بأمان
    expect(gcodeResult.estimatedTime).toBeGreaterThan(0);
  });

  it('يجب رفض التصاميم المخالفة للمعايير الفيزيائية (القطر الأعلى أصغر من قطر القاع)', () => {
    const invalidPan = {
      bottomDiameter: 250,
      topDiameter: 120, // مخالف: القطر الأعلى أصغر من القاع للمقلاة المخروطية
      height: 50,
      wallThickness: 2.0
    };

    const panValidation = ConfigValidator.validatePan(invalidPan);
    expect(panValidation.success).toBe(false);
  });
});
