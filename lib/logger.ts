/**
 * Pino logger - MIT licensed, free.
 * Writes to logs/app.log (JSON) and stdout (pretty in dev).
 */

import pino from 'pino';
import path from 'path';
import fs from 'fs';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function createLogger() {
  ensureLogDir();

  const isDev = process.env.NODE_ENV !== 'production';
  const streams: pino.StreamEntry[] = [
    // File: always JSON for parsing
    {
      stream: pino.destination({ dest: LOG_FILE, append: true, mkdir: true }),
      level: 'info',
    },
  ];

  // Console: pretty in dev, JSON in prod
  if (isDev) {
    const pretty = require('pino-pretty');
    streams.push({
      stream: pretty({ colorize: true, translateTime: 'SYS:HH:MM:ss' }),
      level: 'info',
    });
  } else {
    streams.push({ stream: process.stdout, level: 'info' });
  }

  return pino(
    {
      level: process.env.LOG_LEVEL || 'info',
      base: { pid: process.pid },
    },
    pino.multistream(streams)
  );
}

export const logger = createLogger();

/** Child logger for Telegram-related logs (easier to grep/filter) */
export const telegramLogger = logger.child({ module: 'telegram' });
