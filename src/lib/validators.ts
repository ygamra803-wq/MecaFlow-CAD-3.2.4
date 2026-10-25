import { z } from 'zod';

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  constructor(public errors: ValidationErrorItem[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

const TubeConfigSchema = z.object({
  width: z.number().gt(0, 'العرض يجب أن يكون أكبر من 0'),
  height: z.number().gt(0, 'الارتفاع يجب أن يكون أكبر من 0'),
  thickness: z.number().gt(0),
  totalLength: z.number().gt(0, 'الطول الإجمالي يجب أن يكون أكبر من 0'),
  partLength: z.number().gt(0),
});

export function validateTubeConfig(config: any) {
  const result = TubeConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new ValidationError(errors);
  }
}

const PanConfigSchema = z.object({
  bottomDiameter: z.number().gt(0, 'قطر القاع يجب أن يكون أكبر من 0'),
  topDiameter: z.number().gt(0),
  height: z.number().gt(0, 'الارتفاع يجب أن يكون أكبر من 0'),
  curveRadius: z.number().gte(0, 'نصف قطر المنحنى لا يمكن أن يكون سالباً').optional(),
  wallThickness: z.number().gt(0, 'سمك الجدار يجب أن يكون أكبر من 0').optional(),
}).refine(data => data.topDiameter > data.bottomDiameter, {
  message: 'قطر الأعلى يجب أن يكون أكبر من قطر القاع',
  path: ['topDiameter']
});

export function validatePanConfig(config: any) {
  const result = PanConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new ValidationError(errors);
  }
}

const AssemblyConfigSchema = z.object({
  tiltAngle: z.number().min(-90).max(90),
  insertionDistance: z.number().gte(0),
});

export function validateAssemblyConfig(config: any) {
  const result = AssemblyConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new ValidationError(errors);
  }
}

export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('webgl2'))
    );
  } catch (e) {
    return false;
  }
}
