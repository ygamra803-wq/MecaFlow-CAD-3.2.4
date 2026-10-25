export class GeometryWorker {
  private worker: Worker;

  constructor() {
    const workerCode = `
      self.onmessage = function(e) {
        if (e.data.type === 'CALCULATE') {
          self.postMessage({ status: 'COMPLETE', params: e.data.params });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
  }

  async calculateGeometry(params: Record<string, number>) {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => resolve(e.data);
      this.worker.onerror = reject;
      this.worker.postMessage({ type: 'CALCULATE', params });
    });
  }
}
