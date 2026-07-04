const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { app } = require('electron');

class WorkflowRecorder {
  constructor() {
    this.recording = [];
    this.isRecording = false;
    this.lastStep = 0;
    this.workflowDir = null;
  }

  _ensureDir() {
    if (!this.workflowDir) {
      this.workflowDir = path.join(app.getPath('userData'), 'workflows');
    }
    if (!fs.existsSync(this.workflowDir)) {
      fs.mkdirSync(this.workflowDir, { recursive: true });
    }
  }

  start() {
    this.recording = [];
    this.isRecording = true;
    this.lastStep = Date.now();
    console.log('[Workflow] Recording started');
    return { recording: true };
  }

  record(type, action) {
    if (!this.isRecording) return false;
    const now = Date.now();
    this.recording.push({
      type,
      action,
      delay: now - this.lastStep,
      timestamp: now,
    });
    this.lastStep = now;
    return true;
  }

  stop() {
    this.isRecording = false;
    console.log(`[Workflow] Recording stopped (${this.recording.length} steps)`);
    return { steps: this.recording.length };
  }

  async save(name, description = '') {
    this._ensureDir();
    this.isRecording = false;

    const workflow = {
      name,
      description,
      steps: this.recording,
      created: Date.now(),
      version: '1.0',
    };

    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filePath = path.join(this.workflowDir, `${safeName}.json`);
    await fsPromises.writeFile(filePath, JSON.stringify(workflow, null, 2));
    console.log(`[Workflow] Saved "${name}" to ${filePath}`);
    return { filePath, steps: workflow.steps.length };
  }

  async load(name) {
    this._ensureDir();
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filePath = path.join(this.workflowDir, `${safeName}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Workflow "${name}" not found`);
    }

    return JSON.parse(await fsPromises.readFile(filePath, 'utf-8'));
  }

  async replay(name, executor) {
    const workflow = await this.load(name);
    const results = [];

    console.log(`[Workflow] Replaying "${workflow.name}" (${workflow.steps.length} steps)`);

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];

      if (step.delay > 0) {
        await new Promise(r => setTimeout(r, Math.min(step.delay, 2000)));
      }

      try {
        const result = await executor(step);
        results.push({ step: i, success: true, result });
      } catch (e) {
        results.push({ step: i, success: false, error: e.message });
        console.error(`[Workflow] Step ${i} failed:`, e.message);
      }
    }

    console.log(`[Workflow] Replay complete: ${results.filter(r => r.success).length}/${results.length} succeeded`);
    return results;
  }

  async list() {
    this._ensureDir();
    const files = await fsPromises.readdir(this.workflowDir);
    const workflows = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = JSON.parse(await fsPromises.readFile(path.join(this.workflowDir, file), 'utf-8'));
        workflows.push({
          name: raw.name,
          description: raw.description || '',
          steps: raw.steps?.length || 0,
          created: raw.created,
          file,
        });
      } catch (e) {
        continue;
      }
    }

    return workflows.sort((a, b) => b.created - a.created);
  }

  async deleteWorkflow(name) {
    this._ensureDir();
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filePath = path.join(this.workflowDir, `${safeName}.json`);
    if (fs.existsSync(filePath)) {
      await fsPromises.unlink(filePath);
      return true;
    }
    return false;
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      stepCount: this.recording.length,
    };
  }
}

module.exports = { WorkflowRecorder };
