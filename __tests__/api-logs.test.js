/**
 * Test suite for api/logs.js
 * Tests the POST /api/v1/logs endpoint for client-side logging
 */

const request = require('supertest');
const express = require('express');
const logsRouter = require('../api/logs');

describe('Logs API Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/logs', logsRouter);
  });

  describe('POST /api/v1/logs - Successfully receiving client logs', () => {
    test('should accept log with message and scope', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test client log',
          scope: 'client/app'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should accept info level log', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          level: 'info',
          message: 'Info message',
          scope: 'client/component'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should accept error level log', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          level: 'error',
          message: 'Error occurred',
          scope: 'client/error'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should accept warn level log', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          level: 'warn',
          message: 'Warning message',
          scope: 'client/warning'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should accept debug level log', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          level: 'debug',
          message: 'Debug message',
          scope: 'client/debug'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should accept log with timestamp', async () => {
      const timestamp = '2026-06-03T21:00:00.000Z';
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Timestamped log',
          scope: 'client/app',
          timestamp: timestamp
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should accept log with metadata', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Log with metadata',
          scope: 'client/app',
          meta: {
            userId: '123',
            action: 'click',
            component: 'button'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should accept log with all fields', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          level: 'info',
          message: 'Complete log',
          scope: 'client/app',
          timestamp: '2026-06-03T21:00:00.000Z',
          meta: { userId: '123', action: 'test' }
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should default to info level when not specified', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Default level log',
          scope: 'client/app'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle empty metadata object', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Log with empty meta',
          scope: 'client/app',
          meta: {}
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  describe('POST /api/v1/logs - Parameter Validation', () => {
    test('should require message parameter', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          scope: 'client/app'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });

    test('should require scope parameter', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test message'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });

    test('should reject when both message and scope missing', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });

    test('should reject when message is empty string', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: '',
          scope: 'client/app'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });

    test('should reject when scope is empty string', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test message',
          scope: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });

    test('should reject when message is null', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: null,
          scope: 'client/app'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });

    test('should reject when scope is null', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test message',
          scope: null
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });

    test('should reject when message is undefined', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          scope: 'client/app'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });

    test('should reject when scope is undefined', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test message'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });
  });

  describe('POST /api/v1/logs - Error Handling', () => {
    test('should handle various log levels', async () => {
      const levels = ['info', 'error', 'warn', 'debug'];
      
      for (const level of levels) {
        const response = await request(app)
          .post('/api/v1/logs')
          .send({
            level: level,
            message: `${level} message`,
            scope: 'client/test'
          });
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
      }
    });

    test('should ignore invalid log level and use default', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          level: 'invalid',
          message: 'Test message',
          scope: 'client/app'
        });

      // Should still succeed, treating invalid level as info
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    test('should handle long message strings', async () => {
      const longMessage = 'A'.repeat(10000);
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: longMessage,
          scope: 'client/app'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle special characters in message', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Special chars: !@#$%^&*()_+-=[]{}|;:",.<>?/',
          scope: 'client/app'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle unicode characters in message', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: '日本語のテストメッセージ 🎉',
          scope: 'client/app'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle nested metadata structures', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Nested meta test',
          scope: 'client/app',
          meta: {
            user: {
              id: '123',
              profile: {
                name: 'John',
                roles: ['admin', 'user']
              }
            },
            context: {
              url: '/dashboard',
              referrer: '/login'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  describe('POST /api/v1/logs - Edge Cases', () => {
    test('should handle numeric message (converted to string by request body)', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 12345,
          scope: 'client/app'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle very long scope name', async () => {
      const longScope = 'client/' + 'component/'.repeat(100);
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test',
          scope: longScope
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle message with newlines', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Line 1\nLine 2\nLine 3',
          scope: 'client/app'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle metadata with null values', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test',
          scope: 'client/app',
          meta: {
            value1: null,
            value2: 'something',
            value3: null
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    test('should handle request with empty body gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({});

      // Should fail validation due to missing required fields
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('message and scope required');
    });
  });

  describe('POST /api/v1/logs - Response Format', () => {
    test('should return success response with correct structure', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test',
          scope: 'client/app'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(Object.keys(response.body)).toEqual(['success']);
    });

    test('should return error response with correct structure', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    test('should set correct Content-Type header', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          message: 'Test',
          scope: 'client/app'
        });

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });
});
