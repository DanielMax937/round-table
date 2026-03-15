#!/usr/bin/env tsx
/**
 * 直接调用 createMovie（等效于 POST /api/movies）
 * 当 HTTP 服务无响应时使用
 */
import { createMovie } from '../lib/db/movies';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '../theme-input.json'), 'utf-8'));

(async () => {
  const movie = await createMovie(data);
  console.log(JSON.stringify({ movie }, null, 2));
})();
