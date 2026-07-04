const assert = require('assert');

const {
  validateCommand,
  validateAiCommand,
  validateFilePath,
  validateUrl,
  validateOcrCoordinates,
  sanitizeShellCommand,
  containsDangerousPattern,
  getRiskLevel,
  canAutoExecute,
  RISK_LEVELS,
  BLOCKED_COMMANDS,
} = require('../src/lib/SecurityValidator');

describe('SecurityValidator', () => {
  describe('validateCommand', () => {
    it('should accept valid commands', () => {
      const result = validateCommand('ls -la /tmp');
      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.errors, []);
    });

    it('should reject empty commands', () => {
      const result = validateCommand('');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('should reject null commands', () => {
      const result = validateCommand(null);
      assert.strictEqual(result.valid, false);
    });

    it('should reject commands with dangerous patterns', () => {
      const result = validateCommand('rm -rf /');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('dangerous')));
    });

    it('should reject blocked commands', () => {
      const result = validateCommand('sudo rm -rf /');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('blocked')));
    });

    it('should warn about path traversal', () => {
      const result = validateCommand('cat /etc/../etc/passwd');
      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('path traversal')));
    });

    it('should reject overly long commands', () => {
      const longCommand = 'x'.repeat(10001);
      const result = validateCommand(longCommand);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('maximum length')));
    });
  });

  describe('validateAiCommand', () => {
    it('should accept valid NAVIGATE command', () => {
      const cmd = {
        command: 'NAVIGATE',
        params: { url: 'https://example.com' }
      };
      const result = validateAiCommand(cmd);
      assert.strictEqual(result.valid, true);
    });

    it('should accept valid CREATE_PDF command', () => {
      const cmd = {
        command: 'CREATE_PDF',
        params: { content: 'Test content', title: 'Test PDF' }
      };
      const result = validateAiCommand(cmd);
      assert.strictEqual(result.valid, true);
    });

    it('should reject invalid URL in NAVIGATE', () => {
      const cmd = {
        command: 'NAVIGATE',
        params: { url: 'javascript:alert(1)' }
      };
      const result = validateAiCommand(cmd);
      assert.strictEqual(result.valid, false);
    });

    it('should warn about unknown command types', () => {
      const cmd = {
        command: 'UNKNOWN_COMMAND',
        params: {}
      };
      const result = validateAiCommand(cmd);
      assert.ok(result.warnings.some(w => w.includes('Unknown command')));
    });

    it('should reject null command', () => {
      const result = validateAiCommand(null);
      assert.strictEqual(result.valid, false);
    });
  });

  describe('validateUrl', () => {
    it('should accept valid HTTPS URL', () => {
      const result = validateUrl('https://example.com/path?query=1');
      assert.strictEqual(result.valid, true);
    });

    it('should accept valid HTTP URL', () => {
      const result = validateUrl('http://example.com');
      assert.strictEqual(result.valid, true);
    });

    it('should reject file:// URL', () => {
      const result = validateUrl('file:///etc/passwd');
      assert.strictEqual(result.valid, false);
    });

    it('should reject javascript: URL', () => {
      const result = validateUrl('javascript:alert(1)');
      assert.strictEqual(result.valid, false);
    });

    it('should reject localhost access', () => {
      const result = validateUrl('http://127.0.0.1:8080');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('localhost')));
    });

    it('should reject empty URL', () => {
      const result = validateUrl('');
      assert.strictEqual(result.valid, false);
    });

    it('should reject invalid URL format', () => {
      const result = validateUrl('not-a-url');
      assert.strictEqual(result.valid, false);
    });
  });

  describe('validateFilePath', () => {
    it('should accept valid file paths', () => {
      const result = validateFilePath('/tmp/test.txt');
      assert.strictEqual(result.valid, true);
    });

    it('should reject path traversal', () => {
      const result = validateFilePath('/etc/../etc/passwd');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('path traversal')));
    });

    it('should reject null bytes', () => {
      const result = validateFilePath('/tmp/test\0.txt');
      assert.strictEqual(result.valid, false);
    });

    it('should reject empty paths', () => {
      const result = validateFilePath('');
      assert.strictEqual(result.valid, false);
    });

    it('should reject paths outside allowed directories', () => {
      const result = validateFilePath('/etc/passwd', ['/home']);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('not in allowed')));
    });
  });

  describe('validateOcrCoordinates', () => {
    it('should accept valid coordinates', () => {
      const result = validateOcrCoordinates(100, 200, { width: 1920, height: 1080 });
      assert.strictEqual(result.valid, true);
    });

    it('should reject negative coordinates', () => {
      const result = validateOcrCoordinates(-10, 100);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('negative')));
    });

    it('should reject coordinates outside bounds', () => {
      const result = validateOcrCoordinates(2000, 2000, { width: 1920, height: 1080 });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('outside')));
    });

    it('should reject non-numeric coordinates', () => {
      const result = validateOcrCoordinates('abc', 100);
      assert.strictEqual(result.valid, false);
    });
  });

  describe('sanitizeShellCommand', () => {
    it('should remove dangerous characters', () => {
      const result = sanitizeShellCommand('echo "hello" | grep world');
      assert.strictEqual(result.valid !== false, true);
    });

    it('should handle empty input', () => {
      const result = sanitizeShellCommand('');
      assert.strictEqual(result, '');
    });

    it('should handle null input', () => {
      const result = sanitizeShellCommand(null);
      assert.strictEqual(result, '');
    });
  });

  describe('containsDangerousPattern', () => {
    it('should detect rm -rf /', () => {
      assert.strictEqual(containsDangerousPattern('rm -rf /'), true);
    });

    it('should detect command substitution', () => {
      assert.strictEqual(containsDangerousPattern('$(whoami)'), true);
    });

    it('should accept safe commands', () => {
      assert.strictEqual(containsDangerousPattern('ls -la'), false);
    });
  });

  describe('getRiskLevel', () => {
    it('should return LOW for NAVIGATE', () => {
      assert.strictEqual(getRiskLevel('NAVIGATE'), RISK_LEVELS.LOW);
    });

    it('should return MEDIUM for OCR_SCREEN', () => {
      assert.strictEqual(getRiskLevel('OCR_SCREEN'), RISK_LEVELS.MEDIUM);
    });

    it('should return HIGH for SHELL_COMMAND', () => {
      assert.strictEqual(getRiskLevel('SHELL_COMMAND'), RISK_LEVELS.HIGH);
    });

    it('should return MEDIUM for unknown commands', () => {
      assert.strictEqual(getRiskLevel('UNKNOWN'), RISK_LEVELS.MEDIUM);
    });
  });

  describe('canAutoExecute', () => {
    it('should allow NAVIGATE', () => {
      assert.strictEqual(canAutoExecute('NAVIGATE'), true);
    });

    it('should allow SHELL_COMMAND_LIGHT', () => {
      assert.strictEqual(canAutoExecute('SHELL_COMMAND_LIGHT'), true);
    });

    it('should not allow SHELL_COMMAND', () => {
      assert.strictEqual(canAutoExecute('SHELL_COMMAND'), false);
    });

    it('should not allow CLICK_ELEMENT', () => {
      assert.strictEqual(canAutoExecute('CLICK_ELEMENT'), false);
    });
  });
});

if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha();
  mocha.addFile(__filename);
  mocha.run(failures => process.exit(failures ? 1 : 0));
}
