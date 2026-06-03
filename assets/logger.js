/**
 * Client-side logger for frontend concepts
 * Sends logs to backend and also logs to browser console
 */

class ClientLogger {
  constructor(scope) {
    this.scope = scope;
  }

  async _sendToBackend(level, message, meta = {}) {
    // Only send to backend if available, don't fail if backend is unreachable
    try {
      await fetch('/api/v1/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message,
          scope: this.scope,
          timestamp: new Date().toISOString(),
          meta
        })
      }).catch(() => {}); // Silently fail if fetch fails
    } catch (e) {
      // Silently fail
    }
  }

  info(message, meta = {}) {
    console.log(`[${this.scope}] ${message}`, meta);
    this._sendToBackend('info', message, meta);
  }

  warn(message, meta = {}) {
    console.warn(`[${this.scope}] ${message}`, meta);
    this._sendToBackend('warn', message, meta);
  }

  error(message, meta = {}) {
    console.error(`[${this.scope}] ${message}`, meta);
    this._sendToBackend('error', message, meta);
  }

  debug(message, meta = {}) {
    console.debug(`[${this.scope}] ${message}`, meta);
    this._sendToBackend('debug', message, meta);
  }
}

// Global helper to create scoped loggers
window.createLogger = function(scope) {
  return new ClientLogger(scope);
};
