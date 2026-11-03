import { z } from 'zod';

export interface ValidationErrorItem {
  field: string;
  message: string;
  code?: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  data?: z.infer<typeof FullConfigSchema>;
  errors?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

export class ValidationError extends Error {
  constructor(public errors: ValidationErrorItem[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

export const TubeConfigSchema = z.object({
  width: z.number().gt(0, 'العرض يجب أن يكون أكبر من 0'),
  height: z.number().gt(0, 'الارتفاع يجب أن يكون أكبر من 0'),
  thickness: z.number().gt(0, 'السمك يجب أن يكون أكبر من 0'),
  totalLength: z.number().gt(0, 'الطول الإجمالي يجب أن يكون أكبر من 0'),
  partLength: z.number().gt(0, 'طول الجزء يجب أن يكون أكبر من 0'),
  fixedHeadLength: z.number().gte(0).optional(),
  fixedTailLength: z.number().gte(0).optional(),
  cornerRadius: z.number().gte(0).optional(),
  shape: z.enum(['دائري', 'بيضاوي', 'مستطيل', 'مخصص']).optional(),
});

export function validateTubeConfig(config: unknown) {
  const result = TubeConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new ValidationError(errors);
  }
}

export const PanConfigSchema = z.object({
  bottomDiameter: z.number().gt(0, 'قطر القاع يجب أن يكون أكبر من 0'),
  topDiameter: z.number().gt(0, 'قطر الأعلى يجب أن يكون أكبر من 0'),
  height: z.number().gt(0, 'الارتفاع يجب أن يكون أكبر من 0'),
  curveRadius: z.number().gte(0, 'نصف قطر المنحنى لا يمكن أن يكون سالباً').optional(),
  wallThickness: z.number().gt(0, 'سمك الجدار يجب أن يكون أكبر من 0').optional(),
  wallProfile: z.enum(['straight', 'curved', 'مخصص']).optional(),
}).refine(data => data.topDiameter > data.bottomDiameter, {
  message: 'قطر الأعلى يجب أن يكون أكبر من قطر القاع',
  path: ['topDiameter']
});

export function validatePanConfig(config: unknown) {
  const result = PanConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new ValidationError(errors);
  }
}

export const HandleConfigSchema = z.object({
  shape: z.enum(['rectangular', 'cylindrical', 'مخصص']),
  width: z.number().gt(0, 'عرض المقبض يجب أن يكون أكبر من 0'),
  height: z.number().gt(0, 'ارتفاع المقبض يجب أن يكون أكبر من 0'),
  depth: z.number().gt(0, 'عمق المقبض يجب أن يكون أكبر من 0'),
  thickness: z.number().gt(0).lt(25, 'سمك المقبض غير منطقي'),
  cornerRadius: z.number().gte(0),
  angleX: z.number().min(-180).max(180),
  angleY: z.number().min(-180).max(180),
  offsetZ: z.number(),
  insertionDepth: z.number().gte(0)
});

export function validateHandleConfig(config: unknown) {
  const result = HandleConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new ValidationError(errors);
  }
}

export const AssemblyConfigSchema = z.object({
  tiltAngle: z.number().min(-90).max(90),
  handleAngleX: z.number().min(-180).max(180).optional(),
  handleAngleY: z.number().min(-180).max(180).optional(),
  handleOffset: z.number().optional(),
  insertionDistance: z.number().gte(0),
  heightOffset: z.number().optional(),
  tiltAxis: z.enum(['X', 'Y']).optional(),
});

export function validateAssemblyConfig(config: unknown) {
  const result = AssemblyConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new ValidationError(errors);
  }
}

export const FullConfigSchema = z.object({
  pan: PanConfigSchema,
  tube: TubeConfigSchema,
  handle: HandleConfigSchema,
  assembly: AssemblyConfigSchema
});

/**
 * التحقق الشامل من تهيئة ZeroGap في الوقت الفعلي
 */
export function validateConfig(config: unknown): ConfigValidationResult {
  const result = FullConfigSchema.safeParse(config);
  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    };
  }
  return { isValid: true, data: result.data };
}

export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('webgl2'))
    );
  } catch {
    return false;
  }
}
