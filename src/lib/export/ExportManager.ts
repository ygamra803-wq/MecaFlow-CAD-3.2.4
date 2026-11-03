import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { exportToSTEP, STEPMetadata } from '../stepExporter';
import { generateGcode } from '../gcodeGenerator';
import { generateCadQueryScript } from '../exportUtils';
import { ZeroGapState } from '../../types';
import { AppError, ErrorHandler } from '../errorHandler';
import { globalPluginManager, CustomExporter } from '../pluginManager';
import { defaultRateLimiter } from '../security';

export interface ExportOptions {
  format: 'stl' | 'step' | 'stp' | 'gcode' | 'nc' | 'py' | string;
  quality?: number;
  binary?: boolean;
  includeMetadata?: boolean;
  metadata?: STEPMetadata;
  config?: ZeroGapState;
  fileName?: string;
}

export interface ExportResult {
  success: boolean;
  content: string | Uint8Array | null;
  fileName: string;
  fileSize: number;
  error?: string;
}

/**
 * خدمة التصدير الموحدة (ExportService)
 * تجمع تصدير STL, STEP, G-Code, CadQuery Python مع دعم الإضافات (Plugins) والتحقق من المخرجات.
 */
export class ExportService {
  static registerFormat(format: string, exporter: CustomExporter): void {
    globalPluginManager.loadPlugin({
      id: `custom-exporter-${format}`,
      name: `Custom Exporter (${format})`,
      version: '1.0.0',
      initialize: (app) => {
        app.registerExportFormat(format, exporter);
      }
    });
  }

  static async export(
    mesh: THREE.Object3D | null,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      if (!defaultRateLimiter.check('export-service')) {
        throw new AppError('RATE_LIMITED', 'تم تجاوز الحد المسموح لعمليات التصدير المتتالية، يرجى الانتظار قليلاً.', 'warning');
      }

      const format = options.format.toLowerCase();
      const baseName = options.fileName || `MecaFlow_Part.${format}`;

      // التحقق من وجود مصدر مخصص عبر نظام الـ Plugins
      const customExporter = globalPluginManager.getExporter(format);
      if (customExporter && mesh) {
        const customContent = await customExporter(mesh, options as unknown as Record<string, unknown>);
        const size = typeof customContent === 'string' ? customContent.length : customContent.byteLength;
        return {
          success: true,
          content: customContent,
          fileName: baseName,
          fileSize: size
        };
      }

      switch (format) {
        case 'stl': {
          if (!mesh) {
            throw new AppError('INVALID_MESH', 'لا يوجد مجسم ثلاثي الأبعاد لتصديره بصيغة STL');
          }
          const exporter = new STLExporter();
          const parsed = exporter.parse(mesh, { binary: !!options.binary });
          const content =
            parsed instanceof DataView
              ? new Uint8Array(parsed.buffer)
              : String(parsed);
          const fileSize = typeof content === 'string' ? content.length : content.byteLength;
          return {
            success: fileSize > 0,
            content,
            fileName: baseName,
            fileSize
          };
        }

        case 'step':
        case 'stp': {
          if (!mesh) {
            throw new AppError('INVALID_MESH', 'لا يوجد مجسم ثلاثي الأبعاد لتصديره بصيغة STEP');
          }
          const content = exportToSTEP(mesh, options.metadata);
          return {
            success: content.length > 0,
            content,
            fileName: baseName,
            fileSize: content.length
          };
        }

        case 'gcode':
        case 'nc': {
          if (!options.config) {
            throw new AppError('VALIDATION_ERROR', 'إعدادات الهندسة مطلوبة لتوليد مسار G-Code');
          }
          const content = generateGcode(options.config);
          return {
            success: content.length > 0,
            content,
            fileName: baseName,
            fileSize: content.length
          };
        }

        case 'py': {
          if (!options.config) {
            throw new AppError('VALIDATION_ERROR', 'إعدادات الهندسة مطلوبة لتوليد سكربت CadQuery');
          }
          const content = generateCadQueryScript(options.config);
          return {
            success: content.length > 0,
            content,
            fileName: baseName,
            fileSize: content.length
          };
        }

        default:
          throw new AppError(
            'UNSUPPORTED_FORMAT',
            `صيغة التصدير ${options.format} غير مدعومة`,
            'error'
          );
      }
    } catch (error) {
      const appErr = ErrorHandler.handle(error, 'ExportService');
      return {
        success: false,
        content: null,
        fileName: '',
        fileSize: 0,
        error: appErr.message
      };
    }
  }
}

export class ExportManager {
  static exportSTL(mesh: THREE.Object3D | null): string | null {
    if (!mesh) return null;
    const exporter = new STLExporter();
    return exporter.parse(mesh) as string;
  }

  static async exportSTEP(mesh: THREE.Object3D | null): Promise<string | null> {
    if (!mesh) return null;
    return exportToSTEP(mesh);
  }
}
