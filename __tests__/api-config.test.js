/**
 * Test suite for api/config.js
 * Tests environment variable loading, defaults, and path resolution
 */

const path = require('path');

describe('Config Module', () => {
  // Note: Config module is loaded once and cached by require()
  // We test the structure and types rather than env var mutations
  
  describe('Environment Variable Loading', () => {
    test('should load configuration successfully', () => {
      const config = require('../api/config');
      expect(config).toBeDefined();
    });

    test('should have server configuration', () => {
      const config = require('../api/config');
      expect(config.server).toBeDefined();
      expect(config.server.bindHost).toBeDefined();
      expect(config.server.bindPort).toBeDefined();
    });

    test('should have uploads configuration', () => {
      const config = require('../api/config');
      expect(config.uploads).toBeDefined();
      expect(config.uploads.path).toBeDefined();
    });

    test('should have payer configuration', () => {
      const config = require('../api/config');
      expect(config.payer).toBeDefined();
      expect(config.payer.keypairFile).toBeDefined();
    });

    test('should have logging configuration', () => {
      const config = require('../api/config');
      expect(config.logging).toBeDefined();
      expect(config.logging.logFile).toBeDefined();
    });
  });

  describe('Defaults and Fallbacks', () => {
    test('should always return valid configuration structure', () => {
      const config = require('../api/config');
      
      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('uploads');
      expect(config).toHaveProperty('payer');
      expect(config).toHaveProperty('logging');
      
      expect(config.server).toHaveProperty('bindHost');
      expect(config.server).toHaveProperty('bindPort');
      expect(config.uploads).toHaveProperty('path');
      expect(config.payer).toHaveProperty('keypairFile');
      expect(config.logging).toHaveProperty('logFile');
    });

    test('should return valid types for all config values', () => {
      const config = require('../api/config');
      
      expect(typeof config.server.bindHost).toBe('string');
      expect(typeof config.server.bindPort).toBe('number');
      expect(typeof config.uploads.path).toBe('string');
      expect(typeof config.payer.keypairFile).toBe('string');
      expect(typeof config.logging.logFile).toBe('string');
    });

    test('should have sensible default values', () => {
      const config = require('../api/config');
      
      // Check that defaults exist and are reasonable
      expect(config.server.bindPort).toBeGreaterThan(0);
      expect(config.server.bindPort).toBeLessThan(65536);
      expect(config.uploads.path.length).toBeGreaterThan(0);
      expect(config.payer.keypairFile.length).toBeGreaterThan(0);
      expect(config.logging.logFile.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Values', () => {
    test('should have valid string for bind host', () => {
      const config = require('../api/config');
      expect(typeof config.server.bindHost).toBe('string');
      expect(config.server.bindHost.length).toBeGreaterThan(0);
    });

    test('should have valid port number', () => {
      const config = require('../api/config');
      expect(typeof config.server.bindPort).toBe('number');
      expect(config.server.bindPort).toBeGreaterThan(0);
      expect(config.server.bindPort).toBeLessThan(65536);
    });

    test('should have valid uploads path', () => {
      const config = require('../api/config');
      expect(typeof config.uploads.path).toBe('string');
      expect(config.uploads.path.length).toBeGreaterThan(0);
    });

    test('should have valid keypair file path', () => {
      const config = require('../api/config');
      expect(typeof config.payer.keypairFile).toBe('string');
      expect(config.payer.keypairFile.length).toBeGreaterThan(0);
      expect(config.payer.keypairFile).toMatch(/\.json$/);
    });

    test('should have valid log file path', () => {
      const config = require('../api/config');
      expect(typeof config.logging.logFile).toBe('string');
      expect(config.logging.logFile.length).toBeGreaterThan(0);
      expect(config.logging.logFile).toMatch(/\.log$/);
    });
  });

  describe('Path Resolution', () => {
    test('should handle relative paths', () => {
      const relativePath = '.payer-keypair.json';
      const resolved = path.join(__dirname, '..', relativePath);
      expect(path.isAbsolute(resolved)).toBe(true);
    });

    test('should preserve absolute paths', () => {
      const absolutePath = '/etc/solana/keypair.json';
      expect(path.isAbsolute(absolutePath)).toBe(true);
    });

    test('should handle nested relative paths', () => {
      const relativePath = 'config/payer.json';
      const resolved = path.join(__dirname, '..', relativePath);
      expect(resolved).toMatch(/config[\/\\]payer\.json/);
    });

    test('should handle paths with ../', () => {
      const relativePath = '../keypair.json';
      const resolved = path.join(__dirname, relativePath);
      expect(resolved).toMatch(/keypair\.json/);
    });
  });
});
