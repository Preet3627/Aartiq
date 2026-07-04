const assert = require('assert');
const path = require('path');

const { automationLayer, PLATFORM } = require('../src/automation');

describe('Automation Layer', () => {
  before(async function() {
    this.timeout(10000);
    await automationLayer.initialize();
  });

  describe('Platform Detection', () => {
    it('should detect the current platform', () => {
      assert.ok(['darwin', 'win32', 'linux'].includes(PLATFORM));
    });

    it('should report correct platform', () => {
      if (process.platform === 'darwin') {
        assert.strictEqual(PLATFORM, 'darwin');
      } else if (process.platform === 'win32') {
        assert.strictEqual(PLATFORM, 'win32');
      } else {
        assert.strictEqual(PLATFORM, 'linux');
      }
    });
  });

  describe('Backend Detection', () => {
    it('should report the automation backend', () => {
      assert.ok(['native', 'robotjs', 'none'].includes(automationLayer.backend));
    });

    it('should indicate availability', () => {
      const isAvailable = automationLayer.isAvailable;
      assert.strictEqual(typeof isAvailable, 'boolean');
    });
  });

  describe('getMousePos', () => {
    it('should return valid coordinates', () => {
      const pos = automationLayer.getMousePos();
      assert.ok(typeof pos.x === 'number');
      assert.ok(typeof pos.y === 'number');
      assert.ok(pos.x >= 0);
      assert.ok(pos.y >= 0);
    });
  });

  describe('moveMouse', () => {
    it('should not throw for valid coordinates', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.moveMouse(100, 100);
      });
    });
  });

  describe('click', () => {
    it('should not throw for valid click', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.click(100, 100, 'left', false);
      });
    });

    it('should handle different buttons', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.click(100, 100, 'right', false);
      });
    });

    it('should handle double click', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.click(100, 100, 'left', true);
      });
    });
  });

  describe('typeText', () => {
    it('should handle empty string', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.typeText('');
      });
    });

    it('should handle regular text', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.typeText('Hello World');
      });
    });
  });

  describe('keyTap', () => {
    it('should handle basic keys', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.keyTap('return', []);
      });
    });

    it('should handle keys with modifiers', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.keyTap('a', ['command']);
      });
    });
  });

  describe('scroll', () => {
    it('should handle scroll directions', () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      assert.doesNotThrow(() => {
        automationLayer.scroll(100, 100, 'up', 1);
        automationLayer.scroll(100, 100, 'down', 1);
      });
    });
  });

  describe('executeClickSequence', () => {
    it('should execute a sequence of actions', async () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      const actions = [
        { type: 'move', x: 100, y: 100 },
        { type: 'click', x: 100, y: 100, button: 'left', double: false },
      ];
      
      const results = await automationLayer.executeClickSequence(actions);
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 2);
    });

    it('should stop on error when configured', async () => {
      if (!automationLayer.isAvailable) {
        console.log('Skipping: automation not available');
        return;
      }
      const actions = [
        { type: 'click', x: 100, y: 100 },
        { type: 'invalid', x: 100, y: 100 },
        { type: 'click', x: 200, y: 200 },
      ];
      
      const results = await automationLayer.executeClickSequence(actions, { stopOnError: true });
      assert.strictEqual(results.length, 2);
    });
  });
});

if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha({ timeout: 10000 });
  mocha.addFile(__filename);
  mocha.run(failures => process.exit(failures ? 1 : 0));
}
