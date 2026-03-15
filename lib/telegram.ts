/**
 * Send text to Telegram. Config from project .env only (no claude-to-im fallback).
 * Required: CTI_TG_BOT_TOKEN, CTI_TG_CHAT_ID. Optional: CTI_PROXY, TELEGRAM_DISABLED.
 * Uses curl for reliable proxy support.
 */

import { spawn } from 'child_process';

const MAX_MESSAGE_LENGTH = 4096;

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
    console.log('[Telegram] Disabled by TELEGRAM_DISABLED, skip send');
    return false;
  }
  if (!botToken || !chatId) {
    console.warn('[Telegram] CTI_TG_BOT_TOKEN or CTI_TG_CHAT_ID not configured, skip send');
    return false;
  }
  console.log('[Telegram] Sending...', proxy ? `(proxy: ${proxy})` : '(no proxy)');

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
        console.warn('[Telegram] sendMessage failed:', JSON.stringify(data).slice(0, 200));
        return false;
      }
      console.log('[Telegram] ✓ Sent');
    } catch (err) {
      console.warn('[Telegram] send error:', err instanceof Error ? err.message : err);
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
  console.log(`[Telegram] 解析到 ${dialogues.length} 条对话，共需发送 ${total} 条消息`);

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
      console.log(`[Telegram] 对话进度 ${i + 1}/${dialogues.length}`);
    }
  }
  console.log(`[Telegram] 完成: 成功 ${sent} 条，失败 ${failed} 条`);
}

