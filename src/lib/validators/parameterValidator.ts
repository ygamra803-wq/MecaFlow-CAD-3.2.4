import { CADState, TubeConfig, PanConfig, HandleConfig, WizardStep } from '../../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * التحقق الشامل من صحة جميع معاملات التصميم
 */
export class ParameterValidator {
  private static readonly TUBE_MIN_WIDTH = 5;
  private static readonly TUBE_MIN_HEIGHT = 5;
  private static readonly TUBE_MIN_THICKNESS = 0.5;
  private static readonly PAN_MIN_DIAMETER = 50;
  private static readonly PAN_MIN_HEIGHT = 10;
  private static readonly ANGLE_MIN = 5;
  private static readonly ANGLE_MAX = 175;

  /**
   * التحقق من المعاملات الخاصة بالمرحلة الحالية فقط
   */
  static validateStepParameters(state: CADState, step: WizardStep): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tubeValidation = this.validateTube(state.zeroGap.tube);
    const panValidation = this.validatePan(state.zeroGap.pan);
    const handleValidation = this.validateHandle(state.zeroGap.handle);
    const angleValidation = this.validateAngles(state);
    const compatibilityValidation = this.validateCompatibility(state);

    if (step === 'tube-design') {
      errors.push(...tubeValidation.errors);
      warnings.push(...tubeValidation.warnings);
    } else if (step === 'pan-design') {
      errors.push(...panValidation.errors);
      warnings.push(...panValidation.warnings);
    } else if (step === 'pan-tube-cut') {
      errors.push(...tubeValidation.errors, ...panValidation.errors, ...angleValidation.errors);
      warnings.push(...tubeValidation.warnings, ...panValidation.warnings, ...angleValidation.warnings);
      // التحقق من توافق الأنبوب والمقلاة
      if (state.zeroGap.tube.width > state.zeroGap.pan.topDiameter || state.zeroGap.tube.height > state.zeroGap.pan.topDiameter) {
        warnings.push(`⚠️ أبعاد الأنبوب قد تكون أكبر من قطر المقلاة`);
      }
      if (state.zeroGap.assembly.insertionDistance > state.zeroGap.tube.totalLength) {
        errors.push(`❌ مسافة الإدراج أكبر من طول الأنبوب`);
      }
    } else if (step === 'handle-design') {
      errors.push(...handleValidation.errors);
      warnings.push(...handleValidation.warnings);
    } else if (step === 'tube-handle-cut') {
      errors.push(...handleValidation.errors, ...tubeValidation.errors);
      warnings.push(...handleValidation.warnings, ...tubeValidation.warnings);
      if (state.zeroGap.handle.insertionDepth > state.zeroGap.tube.totalLength) {
        warnings.push(`⚠️ عمق إدراج المقبض قد يكون أكبر من طول الأنبوب`);
      }
    } else if (step === 'technical-review' || step === 'final-inspect') {
      errors.push(...tubeValidation.errors, ...panValidation.errors, ...handleValidation.errors, ...angleValidation.errors, ...compatibilityValidation.errors);
      warnings.push(...tubeValidation.warnings, ...panValidation.warnings, ...handleValidation.warnings, ...angleValidation.warnings, ...compatibilityValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      severity: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info'
    };
  }

  /**
   * التحقق من جميع المعاملات
   */
  static validateAllParameters(state: CADState): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // التحقق من الأنبوب
    const tubeValidation = this.validateTube(state.zeroGap.tube);
    errors.push(...tubeValidation.errors);
    warnings.push(...tubeValidation.warnings);

    // التحقق من المقلاة
    const panValidation = this.validatePan(state.zeroGap.pan);
    errors.push(...panValidation.errors);
    warnings.push(...panValidation.warnings);

    // التحقق من المقبض
    const handleValidation = this.validateHandle(state.zeroGap.handle);
    errors.push(...handleValidation.errors);
    warnings.push(...handleValidation.warnings);

    // التحقق من الزوايا والتحويلات
    const angleValidation = this.validateAngles(state);
    errors.push(...angleValidation.errors);
    warnings.push(...angleValidation.warnings);

    // التحقق من التوافقية بين الأجزاء
    const compatibilityValidation = this.validateCompatibility(state);
    errors.push(...compatibilityValidation.errors);
    warnings.push(...compatibilityValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      severity: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info'
    };
  }

  /**
   * التحقق من معاملات الأنبوب
   */
  private static validateTube(tube: TubeConfig): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // التحقق من الأبعاد الأساسية
    if (tube.width < this.TUBE_MIN_WIDTH) {
      errors.push(
        `❌ عرض الأنبوب (${tube.width}ملم) أقل من الحد الأدنى (${this.TUBE_MIN_WIDTH}ملم)`
      );
    }

    if (tube.height < this.TUBE_MIN_HEIGHT) {
      errors.push(
        `❌ ارتفاع الأنبوب (${tube.height}ملم) أقل من الحد الأدنى (${this.TUBE_MIN_HEIGHT}ملم)`
      );
    }

    // التحقق من السمك
    const minDim = Math.min(tube.width, tube.height);
    if (tube.thickness > minDim / 2) {
      errors.push(
        `❌ سمك الأنبوب (${tube.thickness}ملم) أكبر من نصف أصغر بعد (${(minDim / 2).toFixed(2)}ملم) - هندسة غير صحيحة`
      );
    }

    if (tube.thickness < this.TUBE_MIN_THICKNESS) {
      warnings.push(
        `⚠️ سمك الأنبوب (${tube.thickness}ملم) صغير جداً - قد تحدث مشاكل في القطع`
      );
    }

    // التحقق من نصف قطر الزوايا
    if (tube.cornerRadius > minDim / 2) {
      errors.push(
        `❌ نصف قطر الزوايا (${tube.cornerRadius}ملم) كبير جداً - قد يسبب هندسة غير صحيحة`
      );
    }

    if (tube.cornerRadius < 0) {
      errors.push(`❌ نصف قطر الزوايا لا يمكن أن يكون سالباً`);
    }

    // التحقق من الطول
    const totalLength = tube.totalLength;
    if (totalLength < 20) {
      warnings.push(`⚠️ طول الأنبوب (${totalLength}ملم) قصير جداً`);
    }

    return { errors, warnings };
  }

  /**
   * التحقق من معاملات المقلاة
   */
  private static validatePan(pan: PanConfig): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (pan.bottomDiameter < this.PAN_MIN_DIAMETER) {
      warnings.push(
        `⚠️ قطر قاع المقلاة (${pan.bottomDiameter}ملم) صغير جداً - قد تحدث مشاكل في الدقة`
      );
    }

    if (pan.topDiameter < pan.bottomDiameter) {
      errors.push(
        `❌ قطر أعلى المقلاة (${pan.topDiameter}ملم) أصغر من قطر القاع (${pan.bottomDiameter}ملم) - هندسة غير صحيحة`
      );
    }

    if (pan.height < this.PAN_MIN_HEIGHT) {
      warnings.push(
        `⚠️ ارتفاع المقلاة (${pan.height}ملم) صغير جداً - قد تحدث مشاكل في التقاطع`
      );
    }

    if (pan.wallThickness > 5) {
      warnings.push(
        `⚠️ سمك جدار المقلاة (${pan.wallThickness}ملم) كبير جداً - قد يؤثر على دقة القطع`
      );
    }

    if (pan.wallThickness < 0.5) {
      errors.push(`❌ سمك جدار المقلاة (${pan.wallThickness}ملم) صغير جداً جداً`);
    }

    if (pan.curveRadius < 0) {
      errors.push(`❌ نصف قطر الانحناء لا يمكن أن يكون سالباً`);
    }

    return { errors, warnings };
  }

  /**
   * التحقق من معاملات المقبض
   */
  private static validateHandle(handle: HandleConfig): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (handle.width < 5) {
      errors.push(`❌ عرض المقبض (${handle.width}ملم) صغير جداً`);
    }

    if (handle.height < 5) {
      errors.push(`❌ ارتفاع المقبض (${handle.height}ملم) صغير جداً`);
    }

    if (handle.depth < 10) {
      warnings.push(`⚠️ عمق المقبض (${handle.depth}ملم) قصير جداً`);
    }

    if (handle.insertionDepth > handle.depth) {
      errors.push(
        `❌ عمق الإدراج (${handle.insertionDepth}ملم) أكبر من عمق المقبض (${handle.depth}ملم)`
      );
    }

    return { errors, warnings };
  }

  /**
   * التحقق من الزوايا
   */
  private static validateAngles(state: CADState): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tiltAngle = state.zeroGap.assembly.tiltAngle;
    const handleAngle = state.zeroGap.assembly.handleAngleY;

    // التحقق من زاوية الميل
    if (tiltAngle < this.ANGLE_MIN || tiltAngle > this.ANGLE_MAX) {
      warnings.push(
        `⚠️ زاوية الميل (${tiltAngle}°) خارج النطاق المعتاد (${this.ANGLE_MIN}° - ${this.ANGLE_MAX}°) - قد تحدث مشاكل في التقاطع`
      );
    }

    if (tiltAngle < 1 || tiltAngle > 179) {
      errors.push(
        `❌ زاوية الميل (${tiltAngle}°) قريبة جداً من الحد - التقاطع غير ممكن`
      );
    }

    // التحقق من زاوية المقبض
    if (Math.abs(handleAngle) > 60) {
      warnings.push(
        `⚠️ زاوية المقبض (${handleAngle}°) كبيرة جداً - قد تسبب مشاكل في التقاطع`
      );
    }

    return { errors, warnings };
  }

  /**
   * التحقق من التوافقية بين الأجزاء
   */
  private static validateCompatibility(state: CADState): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { tube, pan, handle, assembly } = state.zeroGap;

    // التحقق من أن الأنبوب يمكن أن يتقاطع مع المقلاة
    if (tube.width > pan.topDiameter || tube.height > pan.topDiameter) {
      warnings.push(
        `⚠️ أبعاد الأنبوب (${tube.width}×${tube.height}ملم) قد تكون أكبر من قطر المقلاة (${pan.topDiameter}ملم)`
      );
    }

    // التحقق من مسافة الإدراج
    if (assembly.insertionDistance > tube.totalLength) {
      errors.push(
        `❌ مسافة الإدراج (${assembly.insertionDistance}ملم) أكبر من طول الأنبوب (${tube.totalLength}ملم)`
      );
    }

    // التحقق من أن المقبض يمكن أن يتقاطع مع الأنبوب
    if (handle.insertionDepth > tube.totalLength) {
      warnings.push(
        `⚠️ عمق إدراج المقبض (${handle.insertionDepth}ملم) قد يكون أكبر من طول الأنبوب (${tube.totalLength}ملم)`
      );
    }

    return { errors, warnings };
  }

  /**
   * التحقق من معامل واحد فقط (للتحقق الفوري أثناء التعديل)
   */
  static validateSingleParameter(
    paramName: string,
    value: number,
    state: CADState
  ): { isValid: boolean; message: string } {
    switch (paramName) {
      case 'tubeWidth':
        if (value < this.TUBE_MIN_WIDTH) {
          return { isValid: false, message: `عرض الأنبوب يجب أن يكون على الأقل ${this.TUBE_MIN_WIDTH} ملم` };
        }
        return { isValid: true, message: '' };
      case 'tubeHeight':
        if (value < this.TUBE_MIN_HEIGHT) {
          return { isValid: false, message: `ارتفاع الأنبوب يجب أن يكون على الأقل ${this.TUBE_MIN_HEIGHT} ملم` };
        }
        return { isValid: true, message: '' };
      case 'tubeThickness':
        if (value < this.TUBE_MIN_THICKNESS) {
          return { isValid: false, message: `سمك الأنبوب لا يمكن أن يقل عن ${this.TUBE_MIN_THICKNESS} ملم` };
        }
        const minDim = Math.min(state.zeroGap.tube.width, state.zeroGap.tube.height);
        if (value > minDim / 2) {
          return { isValid: false, message: `سمك الأنبوب كبير كفاية ليسد التجويف بالكامل` };
        }
        return { isValid: true, message: '' };
      case 'panBottomDiameter':
        if (value < this.PAN_MIN_DIAMETER) {
          return { isValid: false, message: `قطر قاع المقلاة يجب أن يكون على الأقل ${this.PAN_MIN_DIAMETER} ملم` };
        }
        return { isValid: true, message: '' };
      case 'panTopDiameter':
        if (value <= state.zeroGap.pan.bottomDiameter) {
          return { isValid: false, message: `قطر قاع المقلاة يجب أن يكون أصغر من قطر أعلى المقلاة` };
        }
        return { isValid: true, message: '' };
      case 'tiltAngle':
        if (value < 1 || value > 179) {
          return { isValid: false, message: `زاوية ميلان الأنبوب يجب أن تكون بين 1 و 179 درجة` };
        }
        return { isValid: true, message: '' };
      default:
        return { isValid: true, message: '' };
    }
  }
}
