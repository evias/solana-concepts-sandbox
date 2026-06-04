/**
 * Logger module with proper scoping, datetime, and file rotation
 * Uses size-based rotation: active file is sandbox.log, archived files are sandbox.log.YYYY-MM-DD
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let logFilePath = config.logging.logFile;

// If it's a relative path, resolve it relative to project root
if (!path.isAbsolute(logFilePath)) {
  logFilePath = path.join(__dirname, '..', logFilePath);
}

// Extract directory from log file path
const logDir = path.dirname(logFilePath);

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

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

const MAX_LOG_SIZE = 1024 * 1024; // 1MB
const rotationInProgress = { value: false };

// Custom transport for size-based rotation
class SizeRotatingFileTransport extends winston.Transport {
  constructor(options = {}) {
    super(options);
    this.filename = options.filename || logFilePath;
    this.maxSize = options.maxSize || MAX_LOG_SIZE;
    this.maxFiles = options.maxFiles || 30;
  }

  log(info, callback) {
    // Prevent concurrent rotations
    if (rotationInProgress.value) {
      this.writeToFile(info, callback);
      return;
    }

    // Check if rotation is needed
    try {
      const stats = fs.statSync(this.filename);
      if (stats.size + JSON.stringify(info).length > this.maxSize) {
        rotationInProgress.value = true;
        this.rotate(() => {
          rotationInProgress.value = false;
          this.writeToFile(info, callback);
        });
        return;
      }
    } catch (err) {
      // File doesn't exist yet, that's ok
    }

    this.writeToFile(info, callback);
  }

  writeToFile(info, callback) {
    // The winston format.printf returns a string, but format.transform returns an object
    // We need to get the formatted string
    let message = '';
    if (info[Symbol.for('message')]) {
      // If winston has already formatted it, use that
      message = info[Symbol.for('message')];
    } else if (this.format && this.format.transform) {
      // Otherwise transform it
      const transformed = this.format.transform(info);
      message = transformed[Symbol.for('message')] || transformed;
    } else {
      message = JSON.stringify(info);
    }
    
    try {
      fs.appendFileSync(this.filename, message + '\n', { flag: 'a' });
      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }

  rotate(callback) {
    try {
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      let rotatedPath = `${this.filename}.${timestamp}`;
      let counter = 1;

      // If file with same day already exists, add counter (.1, .2, etc)
      while (fs.existsSync(rotatedPath) && counter < 100) {
        rotatedPath = `${this.filename}.${timestamp}.${counter}`;
        counter++;
      }

      // Rename current log file to dated version
      fs.renameSync(this.filename, rotatedPath);

      // Clean up old files if needed
      this.cleanupOldFiles();

      if (callback) callback();
    } catch (err) {
      console.error('Error rotating log file:', err);
      if (callback) callback(err);
    }
  }

  cleanupOldFiles() {
    try {
      const files = fs.readdirSync(logDir)
        .filter(f => f.startsWith(path.basename(this.filename) + '.'))
        .sort()
        .reverse();

      // Keep only maxFiles rotated files
      files.slice(this.maxFiles).forEach(file => {
        try {
          fs.unlinkSync(path.join(logDir, file));
        } catch (err) {
          // Ignore cleanup errors
        }
      });
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console output
    new winston.transports.Console(),
    
    // File output with proper size-based rotation
    new SizeRotatingFileTransport({
      filename: logFilePath,
      maxSize: MAX_LOG_SIZE,
      maxFiles: 30,
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
