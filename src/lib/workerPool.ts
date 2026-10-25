export class WorkerPool {
  private queue: Array<{
    data: any;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private isProcessing = false;
  private worker: Worker;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly TIMEOUT_MS = 30000; // 30 ثانية
  private currentTask: {
    data: any;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(workerScript: string) {
    this.worker = new Worker(workerScript);
    this.setupWorkerListeners();
  }

  /**
   * إضافة مهمة إلى الطابور
   */
  async process(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });
      this.processNext();
    });
  }

  /**
   * معالجة المهمة التالية من الطابور
   */
  private processNext(): void {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();

    if (!task) {
      this.isProcessing = false;
      return;
    }

    this.currentTask = task;

    // تعيين timeout
    this.timeout = setTimeout(() => {
      this.isProcessing = false;
      if (this.currentTask) {
        this.currentTask.reject(new Error('انتهت مهلة انتظار معالجة الهندسة'));
        this.currentTask = null;
      }
      this.processNext();
    }, this.TIMEOUT_MS);

    try {
      this.worker.postMessage(task.data);
    } catch (error) {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      this.isProcessing = false;
      task.reject(error instanceof Error ? error : new Error('خطأ غير معروف'));
      this.currentTask = null;
      this.processNext();
    }
  }

  /**
   * إعداد مستمعي Worker
   */
  private setupWorkerListeners(): void {
    this.worker.onmessage = (event) => {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

      if (this.currentTask) {
        this.currentTask.resolve(event.data);
        this.currentTask = null;
      }

      this.isProcessing = false;
      this.processNext();
    };

    this.worker.onerror = (error) => {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

      if (this.currentTask) {
        this.currentTask.reject(error instanceof Error ? error : new Error('خطأ في الـ Worker'));
        this.currentTask = null;
      }

      this.isProcessing = false;
      this.processNext();
    };
  }

  /**
   * إيقاف Worker
   */
  terminate(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.worker.terminate();
  }
}
