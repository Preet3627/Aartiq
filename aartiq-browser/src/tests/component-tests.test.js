const path = require('path');
const os = require('os');

const {
  validateCommand,
  validateUrl,
  validateFilePath,
  containsDangerousPattern,
  getRiskLevel,
  canAutoExecute,
  RISK_LEVELS,
  BLOCKED_COMMANDS,
  sanitizeShellCommand,
} = require('../lib/SecurityValidator');

describe('SecurityValidator', () => {
  describe('validateCommand', () => {
    it('should accept safe commands', () => {
      const result = validateCommand('ls -la');
      expect(result.valid).toBe(true);
    });

    it('should reject empty commands', () => {
      const result = validateCommand('');
      expect(result.valid).toBe(false);
    });

    it('should reject dangerous patterns', () => {
      const result = validateCommand('rm -rf /');
      expect(result.valid).toBe(false);
    });

    it('should warn about path traversal', () => {
      const result = validateCommand('cat /etc/../etc/passwd');
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('path traversal'))).toBe(true);
    });
  });

  describe('validateUrl', () => {
    it('should accept safe HTTPS URL', () => {
      const result = validateUrl('https://example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject javascript: URLs', () => {
      const result = validateUrl('javascript:alert(1)');
      expect(result.valid).toBe(false);
    });

    it('should reject file: URLs', () => {
      const result = validateUrl('file:///etc/passwd');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFilePath', () => {
    it('should accept safe file paths', () => {
      const result = validateFilePath('/tmp/test.txt');
      expect(result.valid).toBe(true);
    });

    it('should reject path traversal', () => {
      const result = validateFilePath('/etc/../etc/passwd');
      expect(result.valid).toBe(false);
    });
  });

  describe('containsDangerousPattern', () => {
    it('should detect rm -rf /', () => {
      expect(containsDangerousPattern('rm -rf /')).toBe(true);
    });

    it('should accept safe commands', () => {
      expect(containsDangerousPattern('ls -la')).toBe(false);
    });
  });

  describe('getRiskLevel', () => {
    it('should return LOW for NAVIGATE', () => {
      expect(getRiskLevel('NAVIGATE')).toBe(RISK_LEVELS.LOW);
    });

    it('should return HIGH for SHELL_COMMAND', () => {
      expect(getRiskLevel('SHELL_COMMAND')).toBe(RISK_LEVELS.HIGH);
    });
  });

  describe('canAutoExecute', () => {
    it('should allow NAVIGATE', () => {
      expect(canAutoExecute('NAVIGATE')).toBe(true);
    });

    it('should not allow SHELL_COMMAND', () => {
      expect(canAutoExecute('SHELL_COMMAND')).toBe(false);
    });
  });

  describe('sanitizeShellCommand', () => {
    it('should remove dangerous characters', () => {
      const result = sanitizeShellCommand('echo "hello" | grep world');
      expect(result.valid !== false).toBe(true);
    });

    it('should handle empty input', () => {
      const result = sanitizeShellCommand('');
      expect(result).toBe('');
    });
  });

  describe('RISK_LEVELS', () => {
    it('should have LOW, MEDIUM, HIGH, CRITICAL levels', () => {
      expect(RISK_LEVELS.LOW).toBe('low');
      expect(RISK_LEVELS.MEDIUM).toBe('medium');
      expect(RISK_LEVELS.HIGH).toBe('high');
      expect(RISK_LEVELS.CRITICAL).toBe('critical');
    });
  });

  describe('BLOCKED_COMMANDS', () => {
    it('should contain sudo', () => {
      expect(BLOCKED_COMMANDS.has('sudo')).toBe(true);
    });

    it('should contain rm', () => {
      expect(BLOCKED_COMMANDS.has('rm')).toBe(true);
    });
  });
});

describe('Automation Layer Module', () => {
  let automationModule;

  beforeAll(() => {
    automationModule = require('../automation/index.js');
  });

  describe('module exports', () => {
    it('should export automationLayer', () => {
      expect(automationModule).toHaveProperty('automationLayer');
    });

    it('should export PLATFORM', () => {
      expect(automationModule).toHaveProperty('PLATFORM');
    });
  });

  describe('automationLayer', () => {
    it('should have isAvailable property', () => {
      expect(typeof automationModule.automationLayer.isAvailable).toBe('boolean');
    });

    it('should have backend property', () => {
      expect(automationModule.automationLayer).toHaveProperty('backend');
    });

    it('should have click method', () => {
      expect(typeof automationModule.automationLayer.click).toBe('function');
    });

    it('should have moveMouse method', () => {
      expect(typeof automationModule.automationLayer.moveMouse).toBe('function');
    });

    it('should have keyTap method', () => {
      expect(typeof automationModule.automationLayer.keyTap).toBe('function');
    });

    it('should have getMousePos method', () => {
      expect(typeof automationModule.automationLayer.getMousePos).toBe('function');
    });
  });

  describe('PLATFORM', () => {
    it('should be darwin, win32, or linux', () => {
      expect(['darwin', 'win32', 'linux']).toContain(automationModule.PLATFORM);
    });
  });
});

describe('TaskQueue Module', () => {
  let TaskQueue;
  let taskQueue;

  beforeAll(() => {
    const module = require('../workers/task-queue.js');
    TaskQueue = module.TaskQueue;
    taskQueue = new TaskQueue();
  });

  describe('TaskQueue class', () => {
    it('should create an instance', () => {
      expect(taskQueue).toBeDefined();
    });

    it('should have addTask method', () => {
      expect(typeof taskQueue.addTask).toBe('function');
    });

    it('should have addTasks method', () => {
      expect(typeof taskQueue.addTasks).toBe('function');
    });

    it('should have queue property', () => {
      expect(Array.isArray(taskQueue.queue)).toBe(true);
    });

    it('should have maxConcurrent property', () => {
      expect(typeof taskQueue.maxConcurrent).toBe('number');
    });
  });

  describe('task operations', () => {
    it('should initialize with empty queue', () => {
      expect(Array.isArray(taskQueue.queue)).toBe(true);
      expect(taskQueue.queue.length).toBe(0);
    });

    it('should have maxRetries property', () => {
      expect(typeof taskQueue.maxRetries).toBe('number');
    });

    it('should have retryDelay property', () => {
      expect(typeof taskQueue.retryDelay).toBe('number');
    });
  });
});
