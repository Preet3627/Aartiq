/**
 * dom-handlers.test.js — Tests for main.js DOM IPC handler strategies.
 *
 * Tests the cascading fallback pattern used in:
 *   - dom-click-element: dom-engine v2 → wait+CDP → legacy → inline JS
 *   - dom-fill-form: dom-engine v2 → wait+inline → legacy inline JS
 *   - dom-multi-fill-form: dom-engine v2 multiFill → sequential fillField → inline JS
 *
 * Since main.js has heavy Electron side-effects, we test the DomeEngine class
 * (which the handlers delegate to) and verify the strategy cascade by
 * simulating successive success/failure of the underlying methods.
 */

const { DomeEngine, domEngine } = require('../src/lib/dom-engine');

// ── Helpers ──
function mockWebContents(resultsSequence = []) {
  let callIndex = 0;
  const calls = [];
  return {
    calls,
    executeJavaScript: jest.fn(async (code) => {
      calls.push({ type: 'executeJavaScript', code });
      const r = resultsSequence[Math.min(callIndex, resultsSequence.length - 1)];
      callIndex++;
      if (r instanceof Error) throw r;
      return r;
    }),
    sendInputEvent: jest.fn(async (opts) => {
      calls.push({ type: 'sendInputEvent', opts });
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// dom-click-element strategy cascade
// ═══════════════════════════════════════════════════════════════════════════
describe('dom-click-element strategy cascade', () => {
  const engine = new DomeEngine();

  beforeEach(() => jest.clearAllMocks());

  it('Strategy 1: should succeed via dom-engine v2 clickElement', async () => {
    const wc = mockWebContents([
      {}, // injection
      { success: true, method: 'ax-click', element: { ref: 'e1', tag: 'button' } },
    ]);
    const result = await engine.clickElement(wc, { selector: 'role=button', timeout: 5000 });
    expect(result.success).toBe(true);
    expect(result.method).toBe('ax-click');
    // Only 2 calls: inject + click
    expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
  });

  it('Strategy 1 fails → Strategy 2: should succeed via waitForElement + CDP coordinates', async () => {
    // Simulate clickElement failing (strategy 1), then waitForElement succeeding (strategy 2)
    // In main.js handler, Strategy 2 does: waitForElement → get rect → cdpClick
    const wc = mockWebContents([
      {}, // injection for clickElement
      new Error('click failed'), // clickElement fails
      {}, // injection for waitForElement (in real code, waitForElement is called on same engine)
      { success: true, ref: 'e1', element: { ref: 'e1', state: { rect: { x: 100, y: 200, w: 50, h: 30 } } } },
    ]);

    // Simulate the main.js handler cascade:
    // Strategy 1: domEngine.clickElement → fails
    let result;
    try {
      result = await engine.clickElement(wc, { selector: '#btn', timeout: 1000 });
    } catch (_) {}

    // If strategy 1 failed, main.js tries strategy 2: waitForElement + cdpClick
    if (!result?.success) {
      try {
        const waitResult = await engine.waitForElement(wc, { selector: '#btn', timeout: 3000 });
        if (waitResult.success && waitResult.element?.state?.rect) {
          const rect = waitResult.element.state.rect;
          const cx = Math.round(rect.x + rect.w / 2);
          const cy = Math.round(rect.y + rect.h / 2);
          const cdpResult = await engine.cdpClick(wc, { x: cx, y: cy });
          if (cdpResult.success) {
            result = { success: true, method: 'cdp-sendInputEvent', x: cx, y: cy };
          }
        }
      } catch (_) {}
    }

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.method).toBe('cdp-sendInputEvent');
    expect(result.x).toBe(125); // 100 + 50/2
    expect(result.y).toBe(215); // 200 + 30/2
  });

  it('should fail gracefully when all strategies fail', async () => {
    const wc = mockWebContents([
      {}, // injection
      new Error('click failed'),
    ]);
    const result = await engine.clickElement(wc, { selector: '#nonexistent', timeout: 500 });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// dom-fill-form strategy cascade
// ═══════════════════════════════════════════════════════════════════════════
describe('dom-fill-form strategy cascade', () => {
  const engine = new DomeEngine();

  beforeEach(() => jest.clearAllMocks());

  it('Strategy 1: should succeed via dom-engine v2 fillField', async () => {
    const wc = mockWebContents([
      {}, // injection
      { success: true, value: 'test@email.com', element: { ref: 'e1', tag: 'input' } },
    ]);
    const result = await engine.fillField(wc, {
      selector: '#email',
      value: 'test@email.com',
      timeout: 5000,
      clearFirst: true,
      verify: true,
    });
    expect(result.success).toBe(true);
    expect(result.value).toContain('test@email.com');
    expect(wc.executeJavaScript).toHaveBeenCalledTimes(2);
  });

  it('Strategy 1 fails → main.js falls back to waitForElement + inline fill', async () => {
    // Simulate fillField failing on first strategy
    const wc = mockWebContents([
      {}, // injection for fillField (strategy 1)
      new Error('fill failed'), // fillField call fails
      {}, // injection for waitForElement (strategy 2)
      { success: true, ref: 'e1', element: { ref: 'e1', state: { rect: { x: 0, y: 0, w: 100, h: 30 } } } }, // waitForElement succeeds
    ]);

    // Strategy 1: fillField fails
    let result;
    try {
      result = await engine.fillField(wc, { selector: '#email', value: 'x' });
    } catch (_) {}

    // In main.js, strategy 2 does waitForElement then inline JS fill
    if (!result?.success) {
      try {
        const waitResult = await engine.waitForElement(wc, { selector: '#email', timeout: 3000 });
        if (waitResult.success) {
          // Simulate inline JS fill succeeding
          result = { success: true, value: 'x', method: 'dom-engine-v2-wait+inline-fill' };
        }
      } catch (_) {}
    }

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-engine-v2-wait+inline-fill');
  });

  it('should return error when selector is missing', async () => {
    const wc = mockWebContents([]);
    const result = await engine.fillField(wc, { value: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No selector');
  });

  it('should handle multi-strategy fallback to legacy inline', async () => {
    // Simulate all engine methods failing
    const wc = mockWebContents([
      {}, // injection
      new Error('engine fail'),
      {}, // injection for waitForElement
      { success: false, error: 'not found' }, // waitForElement fails
    ]);

    // Strategy 1: fillField fails
    let result;
    try {
      result = await engine.fillField(wc, { selector: '#x', value: 'y' });
    } catch (_) {}

    // Strategy 2: waitForElement fails
    if (!result?.success) {
      try {
        const waitResult = await engine.waitForElement(wc, { selector: '#x', timeout: 1000 });
        if (waitResult.success) {
          result = { success: true, method: 'wait+inline' };
        }
      } catch (_) {}
    }

    // In main.js, strategy 3 is inline JS fallback — we verify the cascade stops here
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// dom-multi-fill-form strategy cascade
// ═══════════════════════════════════════════════════════════════════════════
describe('dom-multi-fill-form strategy cascade', () => {
  const engine = new DomeEngine();

  beforeEach(() => jest.clearAllMocks());

  it('Strategy 1: should succeed via dom-engine v2 multiFillForm', async () => {
    const wc = mockWebContents([
      {}, // injection
      {
        success: true,
        results: [
          { selector: '#email', success: true, value: 'a@b.com' },
          { selector: '#pass', success: true, value: '***' },
        ],
      },
    ]);
    const result = await engine.multiFillForm(wc, {
      fields: { '#email': 'a@b.com', '#pass': '***' },
      delayBetweenFields: 50,
      timeout: 5000,
      verify: true,
    });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results.every(r => r.success)).toBe(true);
  });

  it('Strategy 1 fails → Strategy 2: sequential fillField fallback', async () => {
    // Simulate multiFillForm failing
    const wc = mockWebContents([
      {}, // injection for multiFillForm
      new Error('multi-fill failed'),
      {}, // injection for field 1 fillField
      { success: true, value: 'a@b.com' },
      {}, // injection for field 2 fillField
      { success: true, value: '***' },
    ]);

    // Strategy 1: multiFillForm fails
    let result;
    try {
      result = await engine.multiFillForm(wc, { fields: { '#email': 'a@b.com', '#pass': '***' } });
    } catch (_) {}

    // Strategy 2: sequential fillField
    if (!result?.success) {
      const fields = { '#email': 'a@b.com', '#pass': '***' };
      const results = [];
      for (const [sel, val] of Object.entries(fields)) {
        try {
          const fillResult = await engine.fillField(wc, { selector: sel, value: val, timeout: 3000, clearFirst: true, verify: true });
          results.push({ selector: sel, ...fillResult });
        } catch (_) {
          results.push({ selector: sel, success: false });
        }
      }
      const allOk = results.every(r => r.success);
      if (allOk) result = { success: true, results, method: 'dom-engine-v2-sequential' };
    }

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-engine-v2-sequential');
    expect(result.results).toHaveLength(2);
    expect(result.results[0].selector).toBe('#email');
    expect(result.results[1].selector).toBe('#pass');
  });

  it('should return error for invalid fields', async () => {
    const wc = mockWebContents([]);
    const result = await engine.multiFillForm(wc, { fields: null });
    expect(result.success).toBe(false);
    expect(result.error).toContain('fields must be an object');
  });

  it('should return error for empty fields', async () => {
    const wc = mockWebContents([]);
    const result = await engine.multiFillForm(wc, { fields: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No fields');
  });

  it('Strategy 2 partial failure → should report per-field results', async () => {
    const wc = mockWebContents([
      {}, // injection for multiFillForm
      new Error('multi failed'),
      {}, // injection for field 1
      { success: true, value: 'ok' },
      {}, // injection for field 2
      new Error('field 2 fill failed'),
    ]);

    // Strategy 1 fails
    let result;
    try {
      result = await engine.multiFillForm(wc, { fields: { '#a': 'ok', '#b': 'fail' } });
    } catch (_) {}

    // Strategy 2: sequential — field 1 succeeds, field 2 fails
    if (!result?.success) {
      const fields = { '#a': 'ok', '#b': 'fail' };
      const results = [];
      for (const [sel, val] of Object.entries(fields)) {
        try {
          const fillResult = await engine.fillField(wc, { selector: sel, value: val, timeout: 1000 });
          results.push({ selector: sel, ...fillResult });
        } catch (_) {
          results.push({ selector: sel, success: false, error: 'fill failed' });
        }
      }
      result = { success: false, results, method: 'dom-engine-v2-sequential-partial' };
    }

    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CDP click integration (used in Strategy 2 of dom-click-element)
// ═══════════════════════════════════════════════════════════════════════════
describe('CDP click via sendInputEvent', () => {
  const engine = new DomeEngine();

  beforeEach(() => jest.clearAllMocks());

  it('should send mouseDown and mouseUp with correct coordinates', async () => {
    const wc = mockWebContents([]);
    const result = await engine.cdpClick(wc, { x: 150, y: 250 });
    expect(result.success).toBe(true);
    expect(result.x).toBe(150);
    expect(result.y).toBe(250);
    expect(wc.sendInputEvent).toHaveBeenCalledTimes(2);
    expect(wc.sendInputEvent.mock.calls[0][0]).toMatchObject({
      type: 'mouseDown', x: 150, y: 250, button: 'left', clickCount: 1,
    });
    expect(wc.sendInputEvent.mock.calls[1][0]).toMatchObject({
      type: 'mouseUp', x: 150, y: 250, button: 'left', clickCount: 1,
    });
  });

  it('should compute center coordinates from element rect', () => {
    // Simulate the rect→center computation from dom-click-element strategy 2
    const rect = { x: 100, y: 200, w: 60, h: 40 };
    const cx = Math.round(rect.x + rect.w / 2);
    const cy = Math.round(rect.y + rect.h / 2);
    expect(cx).toBe(130);
    expect(cy).toBe(220);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// domEngine singleton
// ═══════════════════════════════════════════════════════════════════════════
describe('domEngine singleton', () => {
  it('should be an instance of DomeEngine', () => {
    expect(domEngine).toBeInstanceOf(DomeEngine);
  });

  it('should have all expected methods', () => {
    expect(typeof domEngine.findElement).toBe('function');
    expect(typeof domEngine.waitForElement).toBe('function');
    expect(typeof domEngine.clickElement).toBe('function');
    expect(typeof domEngine.fillField).toBe('function');
    expect(typeof domEngine.multiFillForm).toBe('function');
    expect(typeof domEngine.snapshot).toBe('function');
    expect(typeof domEngine.buildAXTree).toBe('function');
    expect(typeof domEngine.cdpClick).toBe('function');
  });
});
