/**
 * Test suite for api/logger.js
 * Tests logger creation, scoping, and formatting
 */

const { createLogger, logger } = require('../api/logger');

describe('Logger Module', () => {
  describe('createLogger Function', () => {
    test('should create a logger with info method', () => {
      const log = createLogger('test-scope');
      expect(log.info).toBeDefined();
      expect(typeof log.info).toBe('function');
    });

    test('should create a logger with warn method', () => {
      const log = createLogger('test-scope');
      expect(log.warn).toBeDefined();
      expect(typeof log.warn).toBe('function');
    });

    test('should create a logger with error method', () => {
      const log = createLogger('test-scope');
      expect(log.error).toBeDefined();
      expect(typeof log.error).toBe('function');
    });

    test('should create a logger with debug method', () => {
      const log = createLogger('test-scope');
      expect(log.debug).toBeDefined();
      expect(typeof log.debug).toBe('function');
    });

    test('should create multiple independent loggers', () => {
      const log1 = createLogger('scope-1');
      const log2 = createLogger('scope-2');
      
      expect(log1).not.toBe(log2);
      expect(log1.info).not.toBe(log2.info);
    });
  });

  describe('Logger Methods', () => {
    let log;
    let logSpy;

    beforeEach(() => {
      log = createLogger('test-scope');
      logSpy = jest.spyOn(logger, 'info');
      jest.spyOn(logger, 'warn');
      jest.spyOn(logger, 'error');
      jest.spyOn(logger, 'debug');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should call logger.info with scope', () => {
      log.info('Test message');
      expect(logger.info).toHaveBeenCalledWith('Test message', expect.objectContaining({
        scope: 'test-scope'
      }));
    });

    test('should call logger.warn with scope', () => {
      log.warn('Warning message');
      expect(logger.warn).toHaveBeenCalledWith('Warning message', expect.objectContaining({
        scope: 'test-scope'
      }));
    });

    test('should call logger.error with scope', () => {
      log.error('Error message');
      expect(logger.error).toHaveBeenCalledWith('Error message', expect.objectContaining({
        scope: 'test-scope'
      }));
    });

    test('should call logger.debug with scope', () => {
      log.debug('Debug message');
      expect(logger.debug).toHaveBeenCalledWith('Debug message', expect.objectContaining({
        scope: 'test-scope'
      }));
    });

    test('should include metadata in logger call', () => {
      const meta = { userId: '123', action: 'test' };
      log.info('Info with metadata', meta);
      expect(logger.info).toHaveBeenCalledWith('Info with metadata', expect.objectContaining({
        scope: 'test-scope',
        userId: '123',
        action: 'test'
      }));
    });

    test('should handle empty metadata', () => {
      log.info('Info message', {});
      expect(logger.info).toHaveBeenCalledWith('Info message', expect.objectContaining({
        scope: 'test-scope'
      }));
    });

    test('should handle default empty metadata parameter', () => {
      log.info('Info message');
      expect(logger.info).toHaveBeenCalledWith('Info message', expect.objectContaining({
        scope: 'test-scope'
      }));
    });
  });

  describe('Scope Handling', () => {
    test('should maintain different scopes', () => {
      const log1 = createLogger('module-a');
      const log2 = createLogger('module-b');
      
      jest.spyOn(logger, 'info');
      
      log1.info('Message from A');
      expect(logger.info).toHaveBeenCalledWith('Message from A', expect.objectContaining({
        scope: 'module-a'
      }));
      
      log2.info('Message from B');
      expect(logger.info).toHaveBeenCalledWith('Message from B', expect.objectContaining({
        scope: 'module-b'
      }));
      
      jest.restoreAllMocks();
    });

    test('should handle nested scope paths', () => {
      const log = createLogger('api/v1/users');
      jest.spyOn(logger, 'info');
      
      log.info('User request');
      expect(logger.info).toHaveBeenCalledWith('User request', expect.objectContaining({
        scope: 'api/v1/users'
      }));
      
      jest.restoreAllMocks();
    });

    test('should handle special characters in scope', () => {
      const log = createLogger('test-scope_123');
      jest.spyOn(logger, 'info');
      
      log.info('Message');
      expect(logger.info).toHaveBeenCalledWith('Message', expect.objectContaining({
        scope: 'test-scope_123'
      }));
      
      jest.restoreAllMocks();
    });
  });

  describe('Main Logger Instance', () => {
    test('should export logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    test('logger should have level property', () => {
      expect(logger.level).toBeDefined();
    });

    test('logger should have format property', () => {
      expect(logger.format).toBeDefined();
    });

    test('logger should have transports property', () => {
      expect(logger.transports).toBeDefined();
      expect(Array.isArray(logger.transports)).toBe(true);
    });
  });

  describe('Complex Metadata Handling', () => {
    let log;

    beforeEach(() => {
      log = createLogger('meta-test');
      jest.spyOn(logger, 'info');
      jest.spyOn(logger, 'error');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should handle nested objects in metadata', () => {
      const meta = { user: { id: '123', name: 'John' } };
      log.info('User action', meta);
      expect(logger.info).toHaveBeenCalledWith('User action', expect.objectContaining({
        scope: 'meta-test',
        user: { id: '123', name: 'John' }
      }));
    });

    test('should handle arrays in metadata', () => {
      const meta = { ids: ['1', '2', '3'] };
      log.info('Batch action', meta);
      expect(logger.info).toHaveBeenCalledWith('Batch action', expect.objectContaining({
        scope: 'meta-test',
        ids: ['1', '2', '3']
      }));
    });

    test('should handle error objects in metadata', () => {
      const err = new Error('Test error');
      const meta = { error: err.message };
      log.error('Error occurred', meta);
      expect(logger.error).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
        scope: 'meta-test',
        error: 'Test error'
      }));
    });

    test('should handle multiple metadata properties', () => {
      const meta = { 
        userId: '123', 
        action: 'create', 
        resource: 'pet',
        timestamp: '2026-06-03'
      };
      log.info('Action performed', meta);
      expect(logger.info).toHaveBeenCalledWith('Action performed', expect.objectContaining({
        scope: 'meta-test',
        userId: '123',
        action: 'create',
        resource: 'pet',
        timestamp: '2026-06-03'
      }));
    });
  });
});
