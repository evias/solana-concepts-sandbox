/**
 * Logs API - receives logs from client and backend
 */

const express = require('express');
const router = express.Router();
const { createLogger } = require('./logger');

const log = createLogger('http/logs');

/**
 * POST /api/v1/logs
 * Receive logs from client-side applications
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
