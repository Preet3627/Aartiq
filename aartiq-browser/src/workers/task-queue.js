const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');

const PRIORITY = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const TASK_TYPE = {
  OCR: 'ocr',
  PDF: 'pdf',
  AI: 'ai',
  AUTOMATION: 'automation',
  GENERAL: 'general',
};

class TaskQueue {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 4;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.queue = [];
    this.running = 0;
    this.completed = 0;
    this.failed = 0;
    this.workers = new Map();
  }

  async addTask(task) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: this._generateId(),
        task,
        priority: task.priority || PRIORITY.NORMAL,
        retries: 0,
        resolve,
        reject,
        createdAt: Date.now(),
      };

      this.queue.push(queueItem);
      this._sortQueue();
      this._processNext();
    });
  }

  async addTasks(tasks) {
    return Promise.all(tasks.map(task => this.addTask(task)));
  }

  _sortQueue() {
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });
  }

  async _processNext() {
    if (this.running >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    const item = this.queue.shift();
    this.running++;

    try {
      const result = await this._executeTask(item);
      this.running--;
      this.completed++;
      item.resolve(result);
    } catch (error) {
      this.running--;
      
      if (item.retries < this.maxRetries) {
        item.retries++;
        await this._delay(this.retryDelay * item.retries);
        this.queue.unshift(item);
        this._sortQueue();
      } else {
        this.failed++;
        item.reject(error);
      }
    }

    this._processNext();
  }

  async _executeTask(item) {
    const { type, payload, workerPath } = item.task;

    if (workerPath) {
      return this._runWorker(workerPath, payload);
    }

    switch (type) {
      case TASK_TYPE.OCR:
        return this._runOcrTask(payload);
      case TASK_TYPE.PDF:
        return this._runPdfTask(payload);
      case TASK_TYPE.AI:
        return this._runAiTask(payload);
      case TASK_TYPE.AUTOMATION:
        return this._runAutomationTask(payload);
      default:
        return this._runGeneralTask(payload);
    }
  }

  async _runWorker(workerPath, payload) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: payload,
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timeout'));
      }, 60000);

      worker.on('message', (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      worker.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  async _runOcrTask(payload) {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text, confidence } } = await worker.recognize(payload.image);
    await worker.terminate();
    return { text, confidence };
  }

  async _runPdfTask(payload) {
    const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const { text, options = {} } = payload;
    
    page.drawText(text || '', {
      x: 50,
      y: 700,
      size: options.fontSize || 12,
      font,
      color: rgb(0, 0, 0),
    });
    
    const pdfBytes = await doc.save();
    return { pdfBytes: Buffer.from(pdfBytes) };
  }

  async _runAiTask(payload) {
    throw new Error('AI tasks should be run via dedicated AI service');
  }

  async _runAutomationTask(payload) {
    throw new Error('Automation tasks should be run via automation layer');
  }

  async _runGeneralTask(payload) {
    if (typeof payload.fn === 'function') {
      return payload.fn(payload.args);
    }
    throw new Error('Invalid general task');
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      completed: this.completed,
      failed: this.failed,
      maxConcurrent: this.maxConcurrent,
    };
  }

  clear() {
    this.queue = [];
  }

  pause() {
    this.maxConcurrent = 0;
  }

  resume(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this._processNext();
  }
}

const globalTaskQueue = new TaskQueue();

module.exports = {
  TaskQueue,
  globalTaskQueue,
  PRIORITY,
  TASK_TYPE,
};
