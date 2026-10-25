// schemas.ts
import { z } from 'zod';

export const TubeConfigSchema = z.object({
  width: z.number()
    .min(5, 'العرض يجب أن يكون >= 5 ملم')
    .max(500, 'العرض يجب أن يكون <= 500 ملم'),
  height: z.number()
    .min(5, 'الارتفاع يجب أن يكون >= 5 ملم')
    .max(500, 'الارتفاع يجب أن يكون <= 500 ملم'),
  thickness: z.number()
    .min(0.1, 'السمك يجب أن يكون >= 0.1 ملم')
    .max(50, 'السمك يجب أن يكون <= 50 ملم'),
  length: z.number()
    .min(20, 'الطول يجب أن يكون >= 20 ملم')
    .max(2000, 'الطول يجب أن يكون <= 2000 ملم'),
  cornerRadius: z.number()
    .min(0, 'نصف قطر الزوايا يجب أن يكون >= 0')
    .max(100, 'نصف قطر الزوايا يجب أن يكون <= 100 ملم')
    .optional(),
  shape: z.enum(['دائري', 'بيضاوي', 'مستطيل', 'مخصص']).optional()
});

export const PanConfigSchema = z.object({
  bottomDiameter: z.number()
    .min(50, 'قطر القاع يجب أن يكون >= 50 ملم')
    .max(500, 'قطر القاع يجب أن يكون <= 500 ملم'),
  topDiameter: z.number()
    .min(50, 'قطر الأعلى يجب أن يكون >= 50 ملم')
    .max(500, 'قطر الأعلى يجب أن يكون <= 500 ملم'),
  height: z.number()
    .min(10, 'الارتفاع يجب أن يكون >= 10 ملم')
    .max(200, 'الارتفاع يجب أن يكون <= 200 ملم'),
  wallThickness: z.number()
    .min(0.5, 'سمك الجدار يجب أن يكون >= 0.5 ملم')
    .max(10, 'سمك الجدار يجب أن يكون <= 10 ملم'),
  curveRadius: z.number()
    .min(0, 'نصف قطر الانحناء يجب أن يكون >= 0')
    .max(300, 'نصف قطر الانحناء يجب أن يكون <= 300 ملم')
    .optional(),
  profileType: z.enum(['curved', 'straight']).optional()
}).refine(
  (data) => data.topDiameter >= data.bottomDiameter,
  {
    message: 'قطر الأعلى يجب أن يكون >= قطر القاع',
    path: ['topDiameter']
  }
);

export const AssemblyConfigSchema = z.object({
  tiltAngle: z.number()
    .min(1, 'زاوية الميل يجب أن تكون >= 1°')
    .max(179, 'زاوية الميل يجب أن تكون <= 179°'),
  handleAngleY: z.number()
    .min(-90, 'زاوية المقبض يجب أن تكون >= -90°')
    .max(90, 'زاوية المقبض يجب أن تكون <= 90°')
    .optional(),
  insertionDistance: z.number()
    .min(0, 'مسافة الإدراج يجب أن تكون >= 0')
    .max(500, 'مسافة الإدراج يجب أن تكون <= 500 ملم')
    .optional(),
  heightOffset: z.number()
    .min(-100, 'إزاحة الارتفاع يجب أن تكون >= -100 ملم')
    .max(100, 'إزاحة الارتفاع يجب أن تكون <= 100 ملم')
    .optional()
});

// Validator class
export class ConfigValidator {
  static validateTube(config: unknown) {
    return TubeConfigSchema.safeParse(config);
  }

  static validatePan(config: unknown) {
    return PanConfigSchema.safeParse(config);
  }

  static validateAssembly(config: unknown) {
    return AssemblyConfigSchema.safeParse(config);
  }

  static validateAll(tubeConfig: unknown, panConfig: unknown, assemblyConfig: unknown) {
    const tubeResult = this.validateTube(tubeConfig);
    const panResult = this.validatePan(panConfig);
    const assemblyResult = this.validateAssembly(assemblyConfig);

    return {
      isValid: tubeResult.success && panResult.success && assemblyResult.success,
      errors: [
        ...(tubeResult.success ? [] : tubeResult.error.issues),
        ...(panResult.success ? [] : panResult.error.issues),
        ...(assemblyResult.success ? [] : assemblyResult.error.issues)
      ]
    };
  }
}
