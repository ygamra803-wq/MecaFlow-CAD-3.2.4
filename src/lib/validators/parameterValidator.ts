import { CADState, TubeConfig, PanConfig, HandleConfig, WizardStep } from '../../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * التحقق الشامل من صحة جميع معاملات التصميم عبر المراحل السبع
 */
export class ParameterValidator {
  private static readonly TUBE_MIN_WIDTH = 5;
  private static readonly TUBE_MIN_HEIGHT = 5;
  private static readonly TUBE_MIN_THICKNESS = 0.5;
  private static readonly PAN_MIN_DIAMETER = 50;
  private static readonly PAN_MIN_HEIGHT = 10;
  private static readonly MAX_SAFE_TILT_ANGLE = 65;
  private static readonly LIMIT_TILT_ANGLE = 85;

  /**
   * التحقق من المعاملات الخاصة بالمرحلة الحالية فقط
   */
  static validateStepParameters(state: CADState | ZeroGapState, step: WizardStep): ValidationResult {
    const normalizedState: CADState = 'zeroGap' in state ? state : ({ zeroGap: state } as CADState);
    const zg = normalizedState.zeroGap;
    const errors: string[] = [];
    const warnings: string[] = [];

    const tubeValidation = this.validateTube(zg.tube);
    const panValidation = this.validatePan(zg.pan);
    const handleValidation = this.validateHandle(zg.handle);
    const angleValidation = this.validateAngles(normalizedState);
    const compatibilityValidation = this.validateCompatibility(normalizedState, step);

    if (step === 'tube-design') {
      errors.push(...tubeValidation.errors);
      warnings.push(...tubeValidation.warnings);
    } else if (step === 'pan-design') {
      errors.push(...panValidation.errors);
      warnings.push(...panValidation.warnings);
    } else if (step === 'pan-tube-cut') {
      errors.push(...tubeValidation.errors, ...panValidation.errors, ...angleValidation.errors);
      warnings.push(...tubeValidation.warnings, ...panValidation.warnings, ...angleValidation.warnings);
      if (zg.tube.width > zg.pan.topDiameter || zg.tube.height > zg.pan.topDiameter) {
        warnings.push(`⚠️ أبعاد الأنبوب قد تكون أكبر من قطر المقلاة العلوي`);
      }
      if (zg.assembly.insertionDistance >= zg.tube.totalLength) {
        errors.push(`❌ مسافة اختراق المقلاة (${zg.assembly.insertionDistance} ملم) تتجاوز الطول الكلي للأنبوب (${zg.tube.totalLength} ملم)`);
      }
    } else if (step === 'handle-design') {
      errors.push(...handleValidation.errors);
      warnings.push(...handleValidation.warnings);
    } else if (step === 'tube-handle-cut') {
      errors.push(...handleValidation.errors, ...tubeValidation.errors);
      warnings.push(...handleValidation.warnings, ...tubeValidation.warnings);
      if (zg.handle.insertionDepth >= zg.tube.totalLength) {
        errors.push(`❌ عمق غرز المقبض (${zg.handle.insertionDepth} ملم) يتجاوز طول الأنبوب (${zg.tube.totalLength} ملم)`);
      } else if (
        zg.assembly.insertionDistance + zg.handle.insertionDepth >=
        zg.tube.totalLength
      ) {
        warnings.push(
          `⚠️ مجموع اختراق المقلاة (${zg.assembly.insertionDistance} ملم) وغرز المقبض (${zg.handle.insertionDepth} ملم) يتداخل داخل طول الأنبوب الخام (${zg.tube.totalLength} ملم)`
        );
      }
    } else if (step === 'technical-review' || step === 'final-inspect') {
      errors.push(
        ...tubeValidation.errors,
        ...panValidation.errors,
        ...handleValidation.errors,
        ...angleValidation.errors,
        ...compatibilityValidation.errors
      );
      warnings.push(
        ...tubeValidation.warnings,
        ...panValidation.warnings,
        ...handleValidation.warnings,
        ...angleValidation.warnings,
        ...compatibilityValidation.warnings
      );
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
  static validateAllParameters(state: CADState | ZeroGapState): ValidationResult {
    return this.validateStepParameters(state, 'final-inspect');
  }

  /**
   * التحقق من معاملات الأنبوب مع مراعاة الشكل الفعلي (دائري / بيضاوي / مستطيل)
   */
  private static validateTube(tube: TubeConfig): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const effectiveHeight = tube.shape === 'دائري' ? tube.width : tube.height;

    if (tube.width < this.TUBE_MIN_WIDTH) {
      errors.push(
        `❌ عرض/قطر الأنبوب (${tube.width} ملم) أقل من الحد الأدنى (${this.TUBE_MIN_WIDTH} ملم)`
      );
    }

    if (effectiveHeight < this.TUBE_MIN_HEIGHT) {
      errors.push(
        `❌ ارتفاع الأنبوب (${effectiveHeight} ملم) أقل من الحد الأدنى (${this.TUBE_MIN_HEIGHT} ملم)`
      );
    }

    const minDim = Math.min(tube.width, effectiveHeight);
    if (tube.thickness >= minDim / 2) {
      errors.push(
        `❌ سماكة الأنبوب (${tube.thickness} ملم) أكبر من أو تساوي نصف أصغر بُعد (${(minDim / 2).toFixed(2)} ملم) مما يسد التجويف الداخلي`
      );
    }

    if (tube.thickness < this.TUBE_MIN_THICKNESS) {
      warnings.push(
        `⚠️ سماكة الأنبوب (${tube.thickness} ملم) رقيقة جداً وقد تسبب تشوهاً حرارياً أثناء القطع بالليزر`
      );
    }

    if (tube.shape === 'مستطيل') {
      if (tube.cornerRadius > minDim / 2) {
        errors.push(
          `❌ نصف قطر الزوايا (${tube.cornerRadius} ملم) يتجاوز نصف أصغر بُعد للأنبوب (${(minDim / 2).toFixed(2)} ملم)`
        );
      }
      if (tube.cornerRadius < 0) {
        errors.push(`❌ نصف قطر الزوايا لا يمكن أن يكون سالباً`);
      }
    }

    if (tube.totalLength < 20) {
      warnings.push(`⚠️ طول الأنبوب (${tube.totalLength} ملم) قصير جداً`);
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
        `⚠️ قطر قاع المقلاة (${pan.bottomDiameter} ملم) صغير نسبياً`
      );
    }

    if (pan.topDiameter < pan.bottomDiameter) {
      errors.push(
        `❌ القطر العلوي للمقلاة (${pan.topDiameter} ملم) أصغر من قطر القاع (${pan.bottomDiameter} ملم)`
      );
    }

    if (pan.height < this.PAN_MIN_HEIGHT) {
      warnings.push(
        `⚠️ ارتفاع المقلاة (${pan.height} ملم) صغير جداً وقد يحد من منطقة التقاطع`
      );
    }

    if (pan.wallThickness > 5) {
      warnings.push(
        `⚠️ سماكة جدار المقلاة (${pan.wallThickness} ملم) كبيرة وقد تؤثر على خلوص اللحام`
      );
    }

    if (pan.wallThickness < 0.5) {
      errors.push(`❌ سماكة جدار المقلاة (${pan.wallThickness} ملم) أقل من الحد الأدنى المسموح (0.5 ملم)`);
    }

    if (pan.curveRadius < 0) {
      errors.push(`❌ نصف قطر تقوس الجدار لا يمكن أن يكون سالباً`);
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

    const effectiveHeight = handle.shape === 'cylindrical' ? handle.width : handle.height;

    if (handle.width < 5) {
      errors.push(`❌ عرض/قطر المقبض (${handle.width} ملم) صغير جداً`);
    }

    if (effectiveHeight < 5) {
      errors.push(`❌ ارتفاع المقبض (${effectiveHeight} ملم) صغير جداً`);
    }

    if (handle.depth < 10) {
      warnings.push(`⚠️ طول المقبض (${handle.depth} ملم) قصير جداً`);
    }

    if (handle.insertionDepth > handle.depth) {
      errors.push(
        `❌ عمق غرز المقبض (${handle.insertionDepth} ملم) أكبر من الطول الكلي للمقبض (${handle.depth} ملم)`
      );
    }

    return { errors, warnings };
  }

  /**
   * التحقق من الزوايا (نطاق زاوية ميلان الأنبوب الفعلي هو -90° إلى +90° حيث 0° تعني الاتصال الأفقي العمودي)
   */
  private static validateAngles(state: CADState): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tiltAngle = state.zeroGap.assembly.tiltAngle;
    const handleRollAngle = state.zeroGap.assembly.handleAngleY;

    if (Math.abs(tiltAngle) > this.LIMIT_TILT_ANGLE) {
      errors.push(
        `❌ زاوية الميل (${tiltAngle}°) حادة جداً وتتجاوز الحد الهندسي (±${this.LIMIT_TILT_ANGLE}°) مما يمنع تقاطع الأنبوب مع جدار المقلاة`
      );
    } else if (Math.abs(tiltAngle) > this.MAX_SAFE_TILT_ANGLE) {
      warnings.push(
        `⚠️ زاوية الميل (${tiltAngle}°) كبيرة وتتجاوز النطاق القياسي (±${this.MAX_SAFE_TILT_ANGLE}°) — يُوصى بمراجعة حواف الشطف`
      );
    }

    if (Math.abs(handleRollAngle) > 60) {
      warnings.push(
        `⚠️ زاوية دوران الأنبوب (${handleRollAngle}°) كبيرة وقد تزيد من تعقيد مسار الليزر`
      );
    }

    return { errors, warnings };
  }

  /**
   * التحقق من التوافقية بين الأجزاء حسب المرحلة
   */
  private static validateCompatibility(
    state: CADState,
    step: WizardStep = 'final-inspect'
  ): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { tube, pan, handle, assembly } = state.zeroGap;
    const effectiveTubeHeight = tube.shape === 'دائري' ? tube.width : tube.height;

    const isStep67 = step === 'technical-review' || step === 'final-inspect';
    const headLen = Math.max(assembly.insertionDistance || 10, 10);
    const tailLen = Math.max(handle.insertionDepth || 10, 10);
    const effectiveLength = isStep67 ? (tube.partLength + headLen + tailLen) : tube.totalLength;

    if (tube.width > pan.topDiameter || effectiveTubeHeight > pan.topDiameter) {
      warnings.push(
        `⚠️ أبعاد الأنبوب (${tube.width}×${effectiveTubeHeight} ملم) أكبر من القطر العلوي للمقلاة (${pan.topDiameter} ملم)`
      );
    }

    if (assembly.insertionDistance >= effectiveLength) {
      errors.push(
        `❌ مسافة الإدراج (${assembly.insertionDistance} ملم) أكبر من الطول الفعلي للأنبوب (${effectiveLength} ملم)`
      );
    }

    if (handle.insertionDepth >= effectiveLength) {
      warnings.push(
        `⚠️ عمق غرز المقبض (${handle.insertionDepth} ملم) يتجاوز الطول الفعلي للأنبوب (${effectiveLength} ملم)`
      );
    }

    if (tube.partLength < 10 && isStep67) {
      errors.push(`❌ طول البدن الصافي للقطعة (${tube.partLength} ملم) أقل من الحد الأدنى التصنيعي (10 ملم)`);
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
    const effectiveHeight =
      state.zeroGap.tube.shape === 'دائري' ? state.zeroGap.tube.width : state.zeroGap.tube.height;

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
      case 'tubeThickness': {
        if (value < this.TUBE_MIN_THICKNESS) {
          return { isValid: false, message: `سمك الأنبوب لا يمكن أن يقل عن ${this.TUBE_MIN_THICKNESS} ملم` };
        }
        const minDim = Math.min(state.zeroGap.tube.width, effectiveHeight);
        if (value >= minDim / 2) {
          return { isValid: false, message: `سمك الأنبوب كبير كفاية ليسد التجويف بالكامل` };
        }
        return { isValid: true, message: '' };
      }
      case 'panBottomDiameter':
        if (value < this.PAN_MIN_DIAMETER) {
          return { isValid: false, message: `قطر قاع المقلاة يجب أن يكون على الأقل ${this.PAN_MIN_DIAMETER} ملم` };
        }
        return { isValid: true, message: '' };
      case 'panTopDiameter':
        if (value < state.zeroGap.pan.bottomDiameter) {
          return { isValid: false, message: `قطر قاع المقلاة يجب أن يكون أصغر من أو يساوي قطر أعلى المقلاة` };
        }
        return { isValid: true, message: '' };
      case 'tiltAngle':
        if (Math.abs(value) > this.LIMIT_TILT_ANGLE) {
          return { isValid: false, message: `زاوية ميلان الأنبوب يجب أن تكون بين -${this.LIMIT_TILT_ANGLE}° و +${this.LIMIT_TILT_ANGLE}°` };
        }
        return { isValid: true, message: '' };
      default:
        return { isValid: true, message: '' };
    }
  }
}
