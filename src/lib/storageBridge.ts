import { save } from '@tauri-apps/api/dialog';
import { writeTextFile, writeBinaryFile } from '@tauri-apps/api/fs';
import Dexie, { Table } from 'dexie';
import { ProjectGeometryState } from '../types';
import { InputSanitizer } from './security';
import { Logger } from './logger';

// 1. Initialize Offline-First Database
export interface ProjectRecord {
  id?: string;
  name: string;
  timestamp: number;
  geometryData: ProjectGeometryState;
  gcode?: string;
}

class MecaFlowDatabase extends Dexie {
  projects!: Table<ProjectRecord>;

  constructor() {
    super('MecaFlowLocalDB');
    this.version(1).stores({
      projects: 'id, name, timestamp'
    });
  }
}

export const localDB = new MecaFlowDatabase();

const isTauri = () => {
  return typeof window !== 'undefined' && (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
};

export const StorageBridge = {
  async getLatestProject(): Promise<ProjectRecord | undefined> {
    const draft = await localDB.projects.get('current_draft_workspace');
    if (draft) return draft;
    const all = await localDB.projects.orderBy('timestamp').reverse().toArray();
    return all.filter(p => p.id !== 'current_draft_workspace')[0];
  },

  async getAllProjects(): Promise<ProjectRecord[]> {
    const all = await localDB.projects.orderBy('timestamp').reverse().toArray();
    return all.filter(p => p.id !== 'current_draft_workspace');
  },

  async deleteProject(id: string): Promise<void> {
    await localDB.projects.delete(id);
  },

  async clearAllProjects(): Promise<void> {
    await localDB.projects.clear();
  },

  /**
   * Save project state to local Dexie.js database with sanitized project name
   */
  async saveProjectToDB(name: string, geometryData: ProjectGeometryState, existingId?: string): Promise<string> {
    const id = existingId || crypto.randomUUID();
    const safeName = InputSanitizer.sanitizeString(name) || 'مشروع_بدون_اسم';
    await localDB.projects.put({
      id,
      name: safeName,
      timestamp: Date.now(),
      geometryData
    });
    return id;
  },

  /**
   * Export G-Code, STEP, or STL directly via native dialog or browser download fallback
   */
  async exportNativeFile(content: string | Uint8Array, defaultFileName: string, isBinary = false): Promise<boolean> {
    const safeFileName = InputSanitizer.sanitizeString(defaultFileName) || 'MecaFlow_Output.stl';

    if (!isTauri()) {
      Logger.info(`Exporting file via browser download: ${safeFileName}`, 'StorageBridge');
      const blob = new Blob([content as BlobPart], { type: isBinary ? 'application/octet-stream' : 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFileName;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }

    try {
      const filePath = await save({
        defaultPath: safeFileName,
        filters: [{
          name: isBinary ? 'CAD Model' : 'CNC / CAD File',
          extensions: isBinary ? ['stl', 'obj'] : ['nc', 'gcode', 'step', 'stp', 'py', 'txt', 'json']
        }]
      });

      if (!filePath) return false;

      if (isBinary && content instanceof Uint8Array) {
        await writeBinaryFile(filePath, content);
      } else if (typeof content === 'string') {
        await writeTextFile(filePath, content);
      }
      return true;
    } catch (error) {
      Logger.error('Native export failed', 'StorageBridge', error instanceof Error ? error : undefined);
      return false;
    }
  }
};
