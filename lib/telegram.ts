/**
 * Send text to Telegram. Config from project .env only (no claude-to-im fallback).
 * Required: CTI_TG_BOT_TOKEN, CTI_TG_CHAT_ID. Optional: CTI_PROXY, TELEGRAM_DISABLED.
 * Uses curl for reliable proxy support.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { telegramLogger as log } from '@/lib/logger';

const MAX_MESSAGE_LENGTH = 4096;
const TELEGRAM_LOG_FILE = path.join(process.cwd(), 'logs', 'telegram.log');

/** 写入 Telegram 专用日志文件，便于统计与 DB 对话数核对 */
function writeTelegramLog(action: string, meta?: Record<string, unknown>): void {
  try {
    const logDir = path.dirname(TELEGRAM_LOG_FILE);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const line =
      JSON.stringify({
        time: new Date().toISOString(),
        action,
        ...meta,
      }) + '\n';
    fs.appendFileSync(TELEGRAM_LOG_FILE, line, 'utf8');
  } catch {
    // 静默失败，不干扰主流程
  }
}

function loadConfig(): {
  botToken: string;
  chatId: string;
  proxy?: string;
  disabled: string;
} {
  const env = process.env;
  const botToken = env.CTI_TG_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN || '';
  const chatId = env.CTI_TG_CHAT_ID || env.TELEGRAM_CHAT_ID || '';
  const proxy = env.CTI_PROXY || env.TELEGRAM_PROXY || '';
  const disabled = env.TELEGRAM_DISABLED || env.DISABLE_TELEGRAM || '';
  return { botToken, chatId, proxy, disabled };
}

/**
 * Send text to Telegram via curl (same approach as telegram-send-file).
 * Splits long messages. Fire-and-forget, never throws.
 */
export async function sendTextToTelegram(text: string): Promise<boolean> {
  const { botToken, chatId, proxy, disabled } = loadConfig();
  if (disabled === 'true' || disabled === '1' || disabled === 'yes') {
    log.info({ skip: true }, 'Disabled by TELEGRAM_DISABLED');
    writeTelegramLog('skipped', { reason: 'TELEGRAM_DISABLED' });
    return false;
  }
  if (!botToken || !chatId) {
    log.warn('CTI_TG_BOT_TOKEN or CTI_TG_CHAT_ID not configured');
    writeTelegramLog('skipped', { reason: 'config_missing' });
    return false;
  }
  log.info({ proxy: proxy || null }, 'Sending...');
  writeTelegramLog('sending', {
    proxy: proxy || null,
    textPreview: text.slice(0, 80).replace(/\n/g, ' '),
    textLength: text.length,
  });

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
    chunks.push(text.slice(i, i + MAX_MESSAGE_LENGTH));
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  for (const chunk of chunks) {
    try {
      const body = JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      });
      const args = ['-s', '-X', 'POST', '-H', 'Content-Type: application/json', '-d', body, url];
      if (proxy) args.splice(0, 0, '-x', proxy);

      const proc = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const out = await new Promise<string>((resolve, reject) => {
        let data = '';
        proc.stdout?.on('data', (c) => (data += c));
        proc.on('close', (code) => {
          if (data) resolve(data);
          else reject(new Error(`curl exit ${code}`));
        });
      });
      const data = JSON.parse(out) as { ok?: boolean };
      if (!data?.ok) {
        log.warn({ response: JSON.stringify(data).slice(0, 200) }, 'sendMessage failed');
        writeTelegramLog('failed', { response: JSON.stringify(data).slice(0, 200) });
        return false;
      }
      log.info('✓ Sent');
      writeTelegramLog('sent', { textLength: chunk.length });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn({ err: errMsg }, 'send error');
      writeTelegramLog('error', { err: errMsg });
      return false;
    }
  }
  return true;
}

/**
 * Send screenplay to Telegram: intro first, then each character's dialogue as a separate message.
 * Used when user wants "每个人的回复单独发送".
 */
export async function sendScriptToTelegramSeparateDialogues(
  script: string,
  options?: { header?: string }
): Promise<void> {
  const { parseScreenplayDialogue, formatDialogueForMessage } = await import(
    '@/lib/movie/script-parser'
  );
  const { intro, dialogues } = parseScreenplayDialogue(script);

  const total = (intro.trim() ? 1 : 0) + dialogues.length;
  log.info({ dialogues: dialogues.length, total }, '解析到对话，共需发送消息');
  writeTelegramLog('script_parse', { dialogues: dialogues.length, total });

  let sent = 0;
  let failed = 0;

  const parts: string[] = [];
  if (options?.header) parts.push(options.header);
  if (intro) parts.push(intro);
  const introText = parts.join('\n\n');
  if (introText.trim()) {
    const ok = await sendTextToTelegram(introText).catch(() => false);
    if (ok) sent++;
    else failed++;
  }
  for (let i = 0; i < dialogues.length; i++) {
    const ok = await sendTextToTelegram(formatDialogueForMessage(dialogues[i])).catch(() => false);
    if (ok) sent++;
    else failed++;
    if ((i + 1) % 5 === 0 || i === dialogues.length - 1) {
      log.info({ progress: `${i + 1}/${dialogues.length}` }, '对话进度');
      writeTelegramLog('script_progress', { progress: `${i + 1}/${dialogues.length}` });
    }
  }
  log.info({ sent, failed }, '完成');
  writeTelegramLog('script_done', { sent, failed, total });
}

