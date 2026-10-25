import { ZeroGapState } from '../types';

export class StepExportService {
  private worker: Worker;
  private callbacks: Map<string, (result: any) => void> = new Map();
  
  constructor() {
    this.worker = new Worker(new URL('./stepExport.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event) => {
      const { id, type, stepString, message } = event.data;
      const callback = this.callbacks.get(id);
      if (callback) {
        if (type === 'STEP_READY') {
          callback({ success: true, stepString });
        } else if (type === 'ERROR') {
          callback({ success: false, error: message });
        }
        this.callbacks.delete(id);
      }
    };
  }
  
  async exportToSTEP(config: ZeroGapState): Promise<string> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.callbacks.set(id, (result) => {
        if (result.success) {
          resolve(result.stepString);
        } else {
          reject(new Error(result.error));
        }
      });
      this.worker.postMessage({ id, type: 'EXPORT_STEP', data: { config } });
    });
  }
  
  terminate() {
    this.worker.terminate();
  }
}
