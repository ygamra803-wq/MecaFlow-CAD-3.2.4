import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { exportToSTEP, STEPMetadata, collectSolidMeshes } from '../stepExporter';
import { GCodeGenerator } from '../gcodeGenerator';
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
 * استخراج مجموعة نظيفة تحتوي فقط على المضلعات الصلبة الحقيقية (بدون خطوط مساعدة أو مسارات ليزر)
 * مع تطبيق المصفوفة العالمية وإعادة حساب المتجهات العمودية (Normals) لضمان ملف STL قياسي خالٍ من العيوب.
 */
export function buildCleanExportGroup(root: THREE.Object3D): THREE.Group {
  const cleanGroup = new THREE.Group();
  const solidMeshes = collectSolidMeshes(root);

  for (const m of solidMeshes) {
    m.updateMatrixWorld(true);
    const clonedGeom = m.geometry.clone();
    clonedGeom.applyMatrix4(m.matrixWorld);
    clonedGeom.computeVertexNormals();
    const cleanMesh = new THREE.Mesh(clonedGeom, new THREE.MeshStandardMaterial());
    cleanGroup.add(cleanMesh);
  }

  return cleanGroup;
}

/**
 * التحقق من سلامة مخرجات STL (ASCII أو Binary)
 */
export function validateSTLOutput(content: string | Uint8Array): boolean {
  if (typeof content === 'string') {
    if (!content.trim().startsWith('solid') || !content.includes('facet normal') || !content.includes('endsolid')) {
      throw new AppError('EXPORT_FAILED', 'ملف STL النصي المصدّر فارغ أو لا يحتوي على مثلثات صالحة', 'error');
    }
    if (content.includes('NaN') || content.includes('Infinity')) {
      throw new AppError('EXPORT_FAILED', 'ملف STL يحتوي على قيم رياضية غير معرفة (NaN/Infinity)', 'error');
    }
    return true;
  }

  // Binary STL: 80-byte header + 4-byte uint32 triangle count + 50 bytes per triangle
  if (content.byteLength < 84) {
    throw new AppError('EXPORT_FAILED', 'ملف STL الثنائي أصغر من الحد الأدنى القياسي (84 بايت)', 'error');
  }
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const triCount = view.getUint32(80, true);
  if (triCount === 0 || content.byteLength !== 84 + triCount * 50) {
    throw new AppError('EXPORT_FAILED', 'ترويسة عدد المثلثات في ملف STL الثنائي غير متطابقة مع حجم الملف', 'error');
  }
  return true;
}

/**
 * خدمة التصدير الموحدة (ExportService)
 * تجمع تصدير STL, STEP, G-Code, CadQuery Python مع دعم الإضافات (Plugins) والتحقق الصارم من المخرجات.
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
          const cleanGroup = buildCleanExportGroup(mesh);
          if (cleanGroup.children.length === 0) {
            throw new AppError('INVALID_MESH', 'المجسم لا يحتوي على مضلعات ثلاثية صالحة لتصدير STL');
          }
          const exporter = new STLExporter();
          const parsed = exporter.parse(cleanGroup, { binary: !!options.binary });
          const content =
            parsed instanceof DataView
              ? new Uint8Array(parsed.buffer, parsed.byteOffset, parsed.byteLength)
              : String(parsed);
          validateSTLOutput(content);
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
          const result = GCodeGenerator.generateGCode(options.config, 'final-inspect');
          if (result.error) {
            throw new AppError('EXPORT_FAILED', result.error, 'error');
          }
          const content = result.gcode;
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
  static exportSTL(mesh: THREE.Object3D | null, binary: boolean = false): string | Uint8Array | null {
    if (!mesh) return null;
    const cleanGroup = buildCleanExportGroup(mesh);
    if (cleanGroup.children.length === 0) return null;
    const exporter = new STLExporter();
    const parsed = exporter.parse(cleanGroup, { binary });
    const content =
      parsed instanceof DataView
        ? new Uint8Array(parsed.buffer, parsed.byteOffset, parsed.byteLength)
        : String(parsed);
    validateSTLOutput(content);
    return content;
  }

  static async exportSTEP(mesh: THREE.Object3D | null): Promise<string | null> {
    if (!mesh) return null;
    return exportToSTEP(mesh);
  }
}
