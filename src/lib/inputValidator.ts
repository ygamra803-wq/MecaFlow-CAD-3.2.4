import * as THREE from 'three';
import { z } from 'zod';

// تعريف الـ schemas
const TubeConfigSchema = z.object({
  width: z.number().min(5).max(500),
  height: z.number().min(5).max(500),
  thickness: z.number().min(0.1).max(50),
  length: z.number().min(20).max(2000),
  cornerRadius: z.number().min(0).max(100),
  shape: z.enum(['rectangular', 'oval', 'circular', 'custom'])
});

const PanConfigSchema = z.object({
  bottomDiameter: z.number().min(50).max(500),
  topDiameter: z.number().min(50).max(500),
  height: z.number().min(10).max(200),
  wallThickness: z.number().min(0.5).max(10),
  curveRadius: z.number().min(0).max(300),
  profileType: z.enum(['curved', 'straight'])
});

const AssemblyConfigSchema = z.object({
  tiltAngle: z.number().min(1).max(179),
  handleAngleY: z.number().min(-90).max(90),
  insertionDistance: z.number().min(0).max(500),
  heightOffset: z.number().min(-100).max(100),
  twistAngle: z.number().min(-180).max(180)
});

// Validator class
export class InputValidator {
  /**
   * التحقق من معاملات الأنبوب
   */
  static validateTubeConfig(config: any): {
    isValid: boolean;
    data?: z.infer<typeof TubeConfigSchema>;
    errors?: string[];
  } {
    try {
      const data = TubeConfigSchema.parse(config);
      return { isValid: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { isValid: false, errors: ['خطأ غير معروف'] };
    }
  }

  /**
   * التحقق من معاملات المقلاة
   */
  static validatePanConfig(config: any): {
    isValid: boolean;
    data?: z.infer<typeof PanConfigSchema>;
    errors?: string[];
  } {
    try {
      const data = PanConfigSchema.parse(config);
      
      // تحقق إضافي: topDiameter >= bottomDiameter
      if (data.topDiameter < data.bottomDiameter) {
        return {
          isValid: false,
          errors: ['قطر الأعلى يجب أن يكون >= قطر القاع']
        };
      }

      return { isValid: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { isValid: false, errors: ['خطأ غير معروف'] };
    }
  }

  /**
   * التحقق من معاملات التجميع
   */
  static validateAssemblyConfig(config: any): {
    isValid: boolean;
    data?: z.infer<typeof AssemblyConfigSchema>;
    errors?: string[];
  } {
    try {
      const data = AssemblyConfigSchema.parse(config);
      return { isValid: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { isValid: false, errors: ['خطأ غير معروف'] };
    }
  }

  /**
   * التحقق من الأرقام
   */
  static validateNumber(
    value: any,
    min: number,
    max: number,
    fieldName: string
  ): { isValid: boolean; error?: string } {
    if (typeof value !== 'number') {
      return { isValid: false, error: `${fieldName} يجب أن يكون رقماً` };
    }

    if (!Number.isFinite(value)) {
      return { isValid: false, error: `${fieldName} يجب أن يكون رقماً صحيحاً` };
    }

    if (value < min || value > max) {
      return {
        isValid: false,
        error: `${fieldName} يجب أن يكون بين ${min} و ${max}`
      };
    }

    return { isValid: true };
  }

  /**
   * التحقق من الـ Geometry
   */
  static validateGeometry(geometry: any): {
    isValid: boolean;
    error?: string;
  } {
    if (!(geometry instanceof THREE.BufferGeometry)) {
      return { isValid: false, error: 'الهندسة يجب أن تكون BufferGeometry' };
    }

    if (!geometry.attributes.position) {
      return { isValid: false, error: 'الهندسة لا تحتوي على position attribute' };
    }

    const positions = geometry.attributes.position.array as Float32Array;
    
    if (positions.length < 9) { // على الأقل 3 نقاط (مثلث واحد)
      return { isValid: false, error: 'الهندسة تحتوي على نقاط قليلة جداً' };
    }

    // التحقق من أن جميع الأرقام صحيحة
    for (let i = 0; i < positions.length; i++) {
      if (!Number.isFinite(positions[i])) {
        return { isValid: false, error: `النقطة ${i} تحتوي على قيمة غير صحيحة` };
      }
    }

    return { isValid: true };
  }
}
