import * as THREE from 'three';

export type GeometryGenerator = (config: Record<string, unknown>) => THREE.BufferGeometry;
export type CustomExporter = (mesh: THREE.Object3D, options?: Record<string, unknown>) => Promise<string | Uint8Array>;
export type CustomValidationRule = (config: Record<string, unknown>) => { isValid: boolean; message?: string };

export interface MecaFlowAppContext {
  registerGeometryType: (type: string, generator: GeometryGenerator) => void;
  registerExportFormat: (format: string, exporter: CustomExporter) => void;
  registerValidationRule: (name: string, rule: CustomValidationRule) => void;
}

export interface MecaFlowPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  initialize?: (app: MecaFlowAppContext) => void | Promise<void>;
  destroy?: () => void | Promise<void>;
}

/**
 * مدير الإضافات (PluginManager) لتوسيع قدرات MecaFlow-CAD
 * يسمح بإضافة مولدات هندسية جديدة، صيغ تصدير، وقواعد تحقق مخصصة.
 */
export class PluginManager {
  private plugins: Map<string, MecaFlowPlugin> = new Map();
  private geometryTypes: Map<string, GeometryGenerator> = new Map();
  private exportFormats: Map<string, CustomExporter> = new Map();
  private validationRules: Map<string, CustomValidationRule> = new Map();

  private get appContext(): MecaFlowAppContext {
    return {
      registerGeometryType: (type, generator) => {
        this.geometryTypes.set(type, generator);
      },
      registerExportFormat: (format, exporter) => {
        this.exportFormats.set(format.toLowerCase(), exporter);
      },
      registerValidationRule: (name, rule) => {
        this.validationRules.set(name, rule);
      }
    };
  }

  async loadPlugin(plugin: MecaFlowPlugin): Promise<boolean> {
    try {
      if (this.plugins.has(plugin.id)) {
        return false;
      }

      if (plugin.initialize) {
        await plugin.initialize(this.appContext);
      }

      this.plugins.set(plugin.id, plugin);
      return true;
    } catch (error) {
      console.error(`Failed to load plugin ${plugin.id}:`, error);
      return false;
    }
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    try {
      if (plugin.destroy) {
        await plugin.destroy();
      }
      this.plugins.delete(pluginId);
      return true;
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      return false;
    }
  }

  getPlugin<T extends MecaFlowPlugin = MecaFlowPlugin>(pluginId: string): T | undefined {
    return this.plugins.get(pluginId) as T | undefined;
  }

  getAllPlugins(): MecaFlowPlugin[] {
    return Array.from(this.plugins.values());
  }

  getExporter(format: string): CustomExporter | undefined {
    return this.exportFormats.get(format.toLowerCase());
  }

  getGeometryGenerator(type: string): GeometryGenerator | undefined {
    return this.geometryTypes.get(type);
  }
}

export const globalPluginManager = new PluginManager();
