import { save } from '@tauri-apps/api/dialog';
import { writeTextFile, writeBinaryFile } from '@tauri-apps/api/fs';
import Dexie, { Table } from 'dexie';

// 1. Initialize Offline-First Database
export interface ProjectRecord {
  id?: string;
  name: string;
  timestamp: number;
  geometryData: any; // Tube/Pan/Handle configs
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

// 2. Native File System Handlers
/**
 * Detects if the app is currently running inside a Tauri container.
 * This prevents crashes when running in a standard browser/preview.
 */
const isTauri = () => {
  return window !== undefined && (window as any).__TAURI__ !== undefined;
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
   * Save project state to local Dexie.js database
   */
  async saveProjectToDB(name: string, geometryData: any, existingId?: string): Promise<string> {
    const id = existingId || crypto.randomUUID();
    await localDB.projects.put({
      id,
      name,
      timestamp: Date.now(),
      geometryData
    });
    return id;
  },

  /**
   * Export G-Code or STL directly via native Windows Save Dialog
   */
  async exportNativeFile(content: string | Uint8Array, defaultFileName: string, isBinary = false): Promise<boolean> {
    // Fallback for web preview if not in Tauri
    if (!isTauri()) {
      console.warn("Native file system not available. Falling back to browser download.");
      const blob = new Blob([content as BlobPart], { type: isBinary ? 'application/octet-stream' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }

    try {
      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [{
          name: isBinary ? 'CAD Model' : 'CNC G-Code',
          extensions: isBinary ? ['stl', 'obj'] : ['nc', 'gcode', 'txt']
        }]
      });

      if (!filePath) return false; // User cancelled

      if (isBinary && content instanceof Uint8Array) {
        await writeBinaryFile(filePath, content);
      } else if (typeof content === 'string') {
        await writeTextFile(filePath, content);
      }
      return true;
    } catch (error) {
      console.error("Native export failed:", error);
      return false;
    }
  }
};
