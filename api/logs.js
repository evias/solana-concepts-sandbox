/**
 * Logs API - receives logs from client and backend
 */

const express = require('express');
const router = express.Router();
const { createLogger } = require('./logger');

const log = createLogger('http/logs');

/**
 * @swagger
 * /api/v1/logs:
 *   post:
 *     tags:
 *       - Logs
 *     summary: Submit client-side logs to server
 *     description: Receives and centralizes logs from client-side applications. Logs are re-emitted through the server's logger with client scope prefixes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - scope
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [info, error, warn, debug]
 *                 description: Log level (defaults to 'info')
 *               message:
 *                 type: string
 *                 description: Log message
 *               scope:
 *                 type: string
 *                 description: Scope/component name for the log
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               meta:
 *                 type: object
 *                 description: Additional metadata
 *     responses:
 *       200:
 *         description: Log received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
router.post('/', (req, res) => {
  try {
    const { level, message, scope, timestamp, meta } = req.body;
    
    if (!message || !scope) {
      return res.status(400).json({ error: 'message and scope required' });
    }
    
    // Re-log through our logger for centralized logging
    const scopedLog = createLogger(`client/${scope}`);
    switch (level || 'info') {
      case 'error':
        scopedLog.error(message, meta);
        break;
      case 'warn':
        scopedLog.warn(message, meta);
        break;
      case 'debug':
        scopedLog.debug(message, meta);
        break;
      default:
        scopedLog.info(message, meta);
    }
    
    return res.json({ success: true });
  } catch (error) {
    log.error('Error processing client log', { error: error.message });
    return res.status(500).json({ error: 'Failed to process log' });
  }
});

module.exports = router;
