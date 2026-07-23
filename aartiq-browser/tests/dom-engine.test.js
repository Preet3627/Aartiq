/**
 * dom-engine.test.js — Unit tests for DomeEngine v2 class.
 *
 * Tests the Node.js-side DomeEngine class which:
 *   - Injects DOM_HELPERS into webContents
 *   - Delegates to window.__domEngineV2 via executeJavaScript
 *   - Provides findElement, waitForElement, clickElement, fillField,
 *     multiFillForm, snapshot, buildAXTree, cdpClick
 */

const { DomeEngine } = require('../src/lib/dom-engine');

function mockWebContents(results = {}) {
  const calls = [];
  return {
    calls,
    executeJavaScript: jest.fn(async (code) => {
      calls.push({ type: 'executeJavaScript', code });
      // Return the result for the most recent call type
      if (results.executeJavaScript) return results.executeJavaScript;
      return { success: true };
    }),
    sendInputEvent: jest.fn(async (opts) => {
      calls.push({ type: 'sendInputEvent', opts });
      if (results.sendInputEvent) return results.sendInputEvent;
    }),
  };
}

describe('DomeEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new DomeEngine();
    jest.clearAllMocks();
  });

  // ── _ensureInjected ──
  describe('_ensureInjected', () => {
    it('should call executeJavaScript to inject DOM_HELPERS', async () => {
      const wc = mockWebContents();
      await engine._ensureInjected(wc);
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(1);
      expect(wc.executeJavaScript.mock.calls[0][0]).toContain('window.__domEngineV2');
    });

    it('should not throw if injection fails', async () => {
      const wc = {
        executeJavaScript: jest.fn().mockRejectedValue(new Error('injection fail')),
      };
      await expect(engine._ensureInjected(wc)).resolves.not.toThrow();
    });
  });

  // ── findElement ──
  describe('findElement', () => {
    it('should return error when no selector provided', async () => {
      const wc = mockWebContents();
      const result = await engine.findElement(wc, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('No selector');
    });

    it('should return error when selector is empty string', async () => {
      const wc = mockWebContents();
      const result = await engine.findElement(wc, { selector: '' });
      expect(result.success).toBe(false);
    });

    it('should inject and delegate to executeJavaScript with selector', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, elements: [{ ref: 'e1', tag: 'button' }], count: 1 },
      });
      const result = await engine.findElement(wc, { selector: 'role=button' });
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2); // inject + find
      expect(result.success).toBe(true);
      expect(result.elements).toHaveLength(1);
    });

    it('should try text param as fallback', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, elements: [], count: 0 },
      });
      await engine.findElement(wc, { text: 'Submit' });
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
    });

    it('should try aria-label param as fallback', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, elements: [], count: 0 },
      });
      await engine.findElement(wc, { 'aria-label': 'Close' });
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
    });

    it('should return error if executeJavaScript throws', async () => {
      const wc = mockWebContents();
      wc.executeJavaScript.mockRejectedValue(new Error('CDP error'));
      const result = await engine.findElement(wc, { selector: '#foo' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('CDP error');
    });
  });

  // ── waitForElement ──
  describe('waitForElement', () => {
    it('should inject and delegate waitForElement call', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, ref: 'e1', state: { visible: true } },
      });
      const result = await engine.waitForElement(wc, { selector: '#input', timeout: 1000 });
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should pass timeout and visible options', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true },
      });
      await engine.waitForElement(wc, { selector: 'role=textbox', timeout: 2000, visible: false });
      const jsCode = wc.executeJavaScript.mock.calls[1][0];
      expect(jsCode).toContain('2000');
      expect(jsCode).toContain('false'); // visible: false
    });

    it('should pass enabled option when defined', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true },
      });
      await engine.waitForElement(wc, { selector: '#btn', enabled: true });
      const jsCode = wc.executeJavaScript.mock.calls[1][0];
      expect(jsCode).toContain('enabled: true');
    });

    it('should handle executeJavaScript failure gracefully', async () => {
      const wc = mockWebContents();
      wc.executeJavaScript.mockRejectedValue(new Error('timeout'));
      const result = await engine.waitForElement(wc, { selector: '#x' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  // ── clickElement ──
  describe('clickElement', () => {
    it('should return error when no selector provided', async () => {
      const wc = mockWebContents();
      const result = await engine.clickElement(wc, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('No selector');
    });

    it('should inject and delegate click to executeJavaScript', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, method: 'ax-click' },
      });
      const result = await engine.clickElement(wc, { selector: 'role=button[name=Submit]' });
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should pass verify and button options', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true },
      });
      await engine.clickElement(wc, { selector: '#btn', timeout: 3000, verify: true, button: 'right' });
      const jsCode = wc.executeJavaScript.mock.calls[1][0];
      expect(jsCode).toContain('3000');
      expect(jsCode).toContain('true'); // verify: true
      expect(jsCode).toContain('"right"');
    });

    it('should try text param as fallback', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true },
      });
      await engine.clickElement(wc, { text: 'Click me' });
      const jsCode = wc.executeJavaScript.mock.calls[1][0];
      expect(jsCode).toContain('Click me');
    });

    it('should try aria-label param as fallback', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true },
      });
      await engine.clickElement(wc, { 'aria-label': 'Menu' });
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
    });
  });

  // ── fillField ──
  describe('fillField', () => {
    it('should return error when no selector provided', async () => {
      const wc = mockWebContents();
      const result = await engine.fillField(wc, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('No selector');
    });

    it('should inject and delegate fill to executeJavaScript', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, value: 'hello' },
      });
      const result = await engine.fillField(wc, { selector: '#email', value: 'hello' });
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should pass timeout, clearFirst, verify options', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true },
      });
      await engine.fillField(wc, {
        selector: 'role=textbox',
        value: 'test',
        timeout: 4000,
        clearFirst: false,
        verify: true,
      });
      const jsCode = wc.executeJavaScript.mock.calls[1][0];
      expect(jsCode).toContain('4000');
      expect(jsCode).toContain('false'); // clearFirst: false
      expect(jsCode).toContain('true');  // verify: true
    });

    it('should handle executeJavaScript failure', async () => {
      const wc = mockWebContents();
      wc.executeJavaScript.mockRejectedValue(new Error('fill error'));
      const result = await engine.fillField(wc, { selector: '#x', value: 'y' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('fill error');
    });
  });

  // ── multiFillForm ──
  describe('multiFillForm', () => {
    it('should return error when fields is not an object', async () => {
      const wc = mockWebContents();
      const result = await engine.multiFillForm(wc, { fields: null });
      expect(result.success).toBe(false);
      expect(result.error).toContain('fields must be an object');
    });

    it('should return error when fields is empty', async () => {
      const wc = mockWebContents();
      const result = await engine.multiFillForm(wc, { fields: {} });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No fields');
    });

    it('should accept array (typeof [] === "object") and attempt fill', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: false, results: [] },
      });
      // Arrays pass the typeof check in multiFillForm; engine proceeds
      const result = await engine.multiFillForm(wc, { fields: ['a', 'b'] });
      // It will either succeed (treating array entries) or return structured failure
      expect(result).toHaveProperty('success');
    });

    it('should inject and delegate multi-fill to executeJavaScript', async () => {
      const wc = mockWebContents({
        executeJavaScript: {
          success: true,
          results: [
            { selector: '#email', success: true },
            { selector: '#pass', success: true },
          ],
        },
      });
      const result = await engine.multiFillForm(wc, {
        fields: { '#email': 'a@b.com', '#pass': 'secret' },
        delayBetweenFields: 50,
        verify: true,
      });
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('should pass timeout option', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, results: [] },
      });
      await engine.multiFillForm(wc, {
        fields: { '#x': 'y' },
        timeout: 2000,
      });
      const jsCode = wc.executeJavaScript.mock.calls[1][0];
      expect(jsCode).toContain('2000');
    });
  });

  // ── snapshot ──
  describe('snapshot', () => {
    it('should inject and call snapshot', async () => {
      const snapshotData = [
        { ref: 'e1', role: 'button', name: 'Submit', tag: 'button' },
        { ref: 'e2', role: 'textbox', name: 'Email', tag: 'input' },
      ];
      const wc = mockWebContents({ executeJavaScript: snapshotData });
      const result = await engine.snapshot(wc);
      expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('button');
    });

    it('should return empty array on failure', async () => {
      const wc = mockWebContents();
      wc.executeJavaScript.mockRejectedValue(new Error('fail'));
      const result = await engine.snapshot(wc);
      expect(result).toEqual([]);
    });
  });

  // ── buildAXTree ──
  describe('buildAXTree', () => {
    it('should inject and call buildAXTree', async () => {
      const tree = [{ ref: 'e1', role: 'main', children: [] }];
      const wc = mockWebContents({ executeJavaScript: tree });
      const result = await engine.buildAXTree(wc);
      expect(result).toEqual(tree);
    });

    it('should return empty array on failure', async () => {
      const wc = mockWebContents();
      wc.executeJavaScript.mockRejectedValue(new Error('ax error'));
      const result = await engine.buildAXTree(wc);
      expect(result).toEqual([]);
    });
  });

  // ── cdpClick ──
  describe('cdpClick', () => {
    it('should send mouseDown and mouseUp events with valid coordinates', async () => {
      const wc = mockWebContents();
      const result = await engine.cdpClick(wc, { x: 100, y: 200 });
      expect(result.success).toBe(true);
      expect(result.method).toBe('sendInputEvent');
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
      expect(wc.sendInputEvent).toHaveBeenCalledTimes(2);
      expect(wc.sendInputEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mouseDown', x: 100, y: 200, button: 'left' }),
      );
      expect(wc.sendInputEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mouseUp', x: 100, y: 200, button: 'left' }),
      );
    });

    it('should fail when x is null', async () => {
      const wc = mockWebContents();
      const result = await engine.cdpClick(wc, { x: null, y: 200 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('valid coordinates');
    });

    it('should fail when y is undefined', async () => {
      const wc = mockWebContents();
      const result = await engine.cdpClick(wc, { x: 100 });
      expect(result.success).toBe(false);
    });

    it('should fail when no coordinates provided', async () => {
      const wc = mockWebContents();
      const result = await engine.cdpClick(wc, {});
      expect(result.success).toBe(false);
    });

    it('should fail when sendInputEvent throws', async () => {
      const wc = {
        sendInputEvent: jest.fn().mockRejectedValue(new Error('input fail')),
        executeJavaScript: jest.fn(),
      };
      const result = await engine.cdpClick(wc, { x: 50, y: 50 });
      expect(result.success).toBe(false);
    });
  });

  // ── Integration: injection happens before every operation ──
  describe('injection integration', () => {
    it('should always inject before findElement', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, elements: [], count: 0 },
      });
      await engine.findElement(wc, { selector: '#x' });
      // First call is inject, second is the actual operation
      const firstCall = wc.executeJavaScript.mock.calls[0][0];
      expect(firstCall).toContain('window.__domEngineV2');
    });

    it('should always inject before clickElement', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true },
      });
      await engine.clickElement(wc, { selector: '#x' });
      const firstCall = wc.executeJavaScript.mock.calls[0][0];
      expect(firstCall).toContain('window.__domEngineV2');
    });

    it('should always inject before fillField', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true },
      });
      await engine.fillField(wc, { selector: '#x', value: 'y' });
      const firstCall = wc.executeJavaScript.mock.calls[0][0];
      expect(firstCall).toContain('window.__domEngineV2');
    });

    it('should always inject before multiFillForm', async () => {
      const wc = mockWebContents({
        executeJavaScript: { success: true, results: [] },
      });
      await engine.multiFillForm(wc, { fields: { '#x': 'y' } });
      const firstCall = wc.executeJavaScript.mock.calls[0][0];
      expect(firstCall).toContain('window.__domEngineV2');
    });
  });

  // ── Exports ──
  describe('exports', () => {
    it('should export DomeEngine class and domEngine singleton', () => {
      const mod = require('../src/lib/dom-engine');
      expect(mod.DomeEngine).toBeDefined();
      expect(mod.domEngine).toBeInstanceOf(mod.DomeEngine);
    });
  });
});
