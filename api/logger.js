/**
 * Logger module with proper scoping, datetime, and file rotation
 * Uses standard libraries: winston for logging, winston-daily-rotate-file for rotation
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('./config');

let logFilePath = config.logging.logFile;

// If it's a relative path, resolve it relative to project root
if (!path.isAbsolute(logFilePath)) {
  logFilePath = path.join(__dirname, '..', logFilePath);
}

// Extract directory from log file path
const logDir = path.dirname(logFilePath);
const logBasename = path.basename(logFilePath, path.extname(logFilePath));
const logExt = path.extname(logFilePath);

// Define custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, scope, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]`;
    if (scope) {
      log += ` [${scope}]`;
    }
    log += ` ${message}`;
    
    // Only add meta if there's useful info
    if (Object.keys(meta).length > 0 && Object.keys(meta).some(k => k !== 'stack')) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (meta.stack) {
      log += `\n${meta.stack}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console output
    new winston.transports.Console(),
    
    // File output with size-based rotation (keeps sandbox.log as active file)
    new DailyRotateFile({
      filename: path.join(logDir, logBasename + logExt),
      datePattern: '', // No date pattern - keeps same filename
      maxSize: '1m', // Rotate when file exceeds 1MB
      maxFiles: '30d', // Keep rotated files for 30 days
      format: customFormat
    })
  ]
});

// Helper function to create scoped logger
function createLogger(scope) {
  return {
    info: (message, meta = {}) => logger.info(message, { scope, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { scope, ...meta }),
    error: (message, meta = {}) => logger.error(message, { scope, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { scope, ...meta })
  };
}

module.exports = {
  logger,
  createLogger
};
