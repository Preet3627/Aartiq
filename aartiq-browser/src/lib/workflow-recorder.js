const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { app } = require('electron');

/**
 * WorkflowRecorder
 * Records and replays sequences of DOM interactions (fill, click, navigate, wait).
 * Each step stores enough context to be replayed by dom-engine.
 */
class WorkflowRecorder {
  constructor() {
    this.recording = [];
    this.isRecording = false;
    this.lastStep = 0;
    this.workflowDir = null;
    this.recordingName = '';
  }

  _ensureDir() {
    if (!this.workflowDir) {
      this.workflowDir = path.join(app.getPath('userData'), 'workflows');
    }
    if (!fs.existsSync(this.workflowDir)) {
      fs.mkdirSync(this.workflowDir, { recursive: true });
    }
  }

  // ---- Recording ----

  start(name = '') {
    this.recording = [];
    this.isRecording = true;
    this.lastStep = Date.now();
    this.recordingName = name || `workflow-${Date.now()}`;
    console.log(`[Workflow] Recording started: "${this.recordingName}"`);
    return { recording: true, name: this.recordingName };
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

  /**
   * Record a DOM-aware step (preferred over raw record()).
   * Types: 'fill', 'click', 'navigate', 'wait', 'scroll', 'type'
   * Each step includes: { type, selector, text, value, url, delay, timestamp }
   */
  recordDomStep(step) {
    if (!this.isRecording) return false;
    const now = Date.now();
    this.recording.push({
      type: step.type || 'action',
      selector: step.selector || null,
      text: step.text || null,
      value: step.value || null,
      url: step.url || null,
      ariaLabel: step.ariaLabel || null,
      delay: now - this.lastStep,
      timestamp: now,
      metadata: step.metadata || null,
    });
    this.lastStep = now;
    return true;
  }

  stop() {
    this.isRecording = false;
    const count = this.recording.length;
    console.log(`[Workflow] Recording stopped (${count} steps)`);
    return { steps: count, name: this.recordingName };
  }

  // ---- Persistence ----

  async save(name, description = '') {
    this._ensureDir();
    this.isRecording = false;
    const workflowName = name || this.recordingName;

    const workflow = {
      name: workflowName,
      description,
      steps: this.recording,
      created: Date.now(),
      version: '2.0',
      stepTypes: [...new Set(this.recording.map(s => s.type))],
    };

    const safeName = workflowName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filePath = path.join(this.workflowDir, `${safeName}.json`);
    await fsPromises.writeFile(filePath, JSON.stringify(workflow, null, 2));
    console.log(`[Workflow] Saved "${workflowName}" (${this.recording.length} steps)`);
    return { filePath, steps: workflow.steps.length, name: workflowName };
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

  // ---- Replay ----

  /**
   * Replay a workflow using a step executor function.
   * executor(step, index) should return { success: boolean, error?: string }
   */
  async replay(name, executor) {
    const workflow = await this.load(name);
    const results = [];

    console.log(`[Workflow] Replaying "${workflow.name}" (${workflow.steps.length} steps)`);

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];

      // Respect recorded delay between steps (capped at 3s)
      if (step.delay > 0 && i > 0) {
        await new Promise(r => setTimeout(r, Math.min(step.delay, 3000)));
      }

      // Wait steps: honor the value as explicit delay
      if (step.type === 'wait') {
        const waitMs = parseInt(step.value || step.delay, 10) || 500;
        await new Promise(r => setTimeout(r, Math.min(waitMs, 10000)));
        results.push({ step: i, success: true, type: 'wait' });
        continue;
      }

      try {
        const result = await executor(step, i);
        results.push({ step: i, success: true, result, type: step.type });
      } catch (e) {
        results.push({ step: i, success: false, error: e.message, type: step.type });
        console.error(`[Workflow] Step ${i} (${step.type}) failed:`, e.message);
      }
    }

    const succeeded = results.filter(r => r.success).length;
    console.log(`[Workflow] Replay complete: ${succeeded}/${results.length} succeeded`);
    return { results, total: results.length, succeeded, failed: results.length - succeeded };
  }

  // ---- Listing ----

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
          stepTypes: raw.stepTypes || [],
          created: raw.created,
          version: raw.version || '1.0',
          file,
        });
      } catch (_) {
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
      name: this.recordingName,
    };
  }

  getSteps() {
    return [...this.recording];
  }
}

module.exports = { WorkflowRecorder };
