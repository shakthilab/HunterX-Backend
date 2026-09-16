// src/utils/logger.js — Console logger with timestamps

export function info(message) {
  console.log(`[${new Date().toISOString()}] INFO: ${message}`);
}

export function logError(message) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
}
