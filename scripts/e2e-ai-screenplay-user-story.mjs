import { chromium } from 'playwright';

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8400';
const headless = process.env.E2E_HEADLESS !== '0';
const title = `E2E短片-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
const theme = [
  '测试短片：一位程序员在午夜发现公司记忆备份系统出错。',
  '请用于端到端测试，故事尽量短，场景、对白和动作都保持精简。',
].join('');

const steps = [];
const issues = [];
const network = [];
const consoleErrors = [];

function log(message) {
  process.stdout.write(`[user-story] ${message}\n`);
}

async function mark(name, fn) {
  const startedAt = Date.now();
  log(`START ${name}`);
  try {
    const result = await fn();
    const item = { name, status: 'ok', ms: Date.now() - startedAt, result: result || null };
    steps.push(item);
    log(`OK ${name} (${item.ms}ms)`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const item = { name, status: 'failed', ms: Date.now() - startedAt, error: message };
    steps.push(item);
    issues.push({ step: name, error: message });
    log(`FAIL ${name}: ${message}`);
    throw error;
  }
}

async function waitForBodyText(page, pattern, timeout = 180000) {
  await page.waitForFunction(
    (source) => new RegExp(source).test(document.body.innerText || ''),
    pattern.source,
    { timeout }
  );
}

async function clickIfUnchecked(locator) {
  if ((await locator.count()) === 0) return false;
  const checked = await locator.first().isChecked().catch(() => false);
  if (!checked) await locator.first().click();
  return true;
}

async function clickAndWaitForPost(page, buttonLocator, pathPart, timeout = 300000) {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes(pathPart) &&
    response.request().method() === 'POST',
    { timeout }
  );
  await buttonLocator.click();
  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error(`${pathPart} returned HTTP ${response.status()}`);
  }
  return response;
}

async function main() {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/movies')) {
      network.push({
        method: response.request().method(),
        status: response.status(),
        url,
      });
    }
  });

  try {
    log(`TITLE ${title}`);

    await mark('从电影列表进入系统自动创作', async () => {
      await page.goto(`${baseUrl}/movies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('link', { name: '+ 系统自动创作' }).click();
      await page.waitForURL(/\/movies\/new\/ai/, { timeout: 30000 });
    });

    await mark('填写主题和标题并进入工作流', async () => {
      await page.getByLabel(/电影主题/).fill(theme);
      await page.getByLabel(/项目标题/).fill(title);
      await page.getByRole('button', { name: '进入系统自动创作' }).click();
      await page.waitForURL(/\/movies\/[^/]+\/workflow/, { timeout: 60000 });
      await waitForBodyText(page, /阶段一：故事提案|AI 剧本创作/, 60000);
      return { url: page.url() };
    });

    await mark('生成并确认故事提案', async () => {
      await page.getByRole('button', { name: '生成 3 个故事提案' }).click();
      await waitForBodyText(page, /确认所选提案/, 240000);
      await page.locator('section').filter({ hasText: '阶段一：故事提案' }).locator('.cursor-pointer').first().click();
      await page.getByRole('button', { name: '确认所选提案' }).click();
      await waitForBodyText(page, /开发读本|生成材料|阶段二：角色与大纲/, 120000);
    });

    await mark('生成开发材料', async () => {
      await page.getByRole('button', { name: /生成材料|补全材料/ }).first().click();
      await waitForBodyText(page, /查看开发材料|补全材料|中心命题/, 420000);
    });

    await mark('生成角色', async () => {
      await page.getByRole('button', { name: '生成角色' }).click();
      await waitForBodyText(page, /生成场景大纲|已生成 \d+ 个角色/, 300000);
    });

    await mark('生成并确认场景大纲', async () => {
      await page.getByRole('button', { name: '生成场景大纲' }).click();
      await waitForBodyText(page, /确认大纲，进入场景生成/, 420000);
      await page.getByRole('button', { name: '确认大纲，进入场景生成' }).click();
      await waitForBodyText(page, /阶段三：场景生成|一键顺序生成并确认剩余/, 120000);
    });

    await mark('查看第一场上下文', async () => {
      await page.getByRole('button', { name: '查看上下文' }).first().click();
      await waitForBodyText(page, /本场上下文|隐藏上下文/, 60000);
    });

    await mark('生成第一场剧本', async () => {
      await page.getByRole('button', { name: '开始生成' }).first().click();
      await waitForBodyText(page, /确认，进入下一场|质检剧本/, 2700000);
    });

    await mark('确认第一场并进入下一场', async () => {
      await page.getByRole('button', { name: '确认，进入下一场' }).first().click();
      await waitForBodyText(page, /当前场景已确认|已确认|小说改编/, 240000);
    });

    await mark('启动小说改编任务', async () => {
      await page.locator('#novel-production').scrollIntoViewIfNeeded();
      await clickAndWaitForPost(
        page,
        page.locator('#novel-production').getByRole('button', { name: /生成小说|重新生成小说/ }),
        '/novel',
        120000
      );
      await waitForBodyText(page, /最近任务|小说改编中|章节进度/, 60000);
    });

    await mark('创建视觉资产任务', async () => {
      await page.locator('#visual-assets').scrollIntoViewIfNeeded();
      await clickIfUnchecked(page.locator('#visual-assets label').filter({ hasText: /场景 1/ }).locator('input[type="checkbox"]'));
      await clickAndWaitForPost(
        page,
        page.locator('#visual-assets').getByRole('button', { name: '生成视觉资产任务' }),
        '/visual-assets',
        300000
      );
      await waitForBodyText(page, /已创建 \d+ 个视觉资产任务|查看提示词 \/ 命令/, 60000);
    });

    await mark('创建视频任务', async () => {
      await page.locator('#video-generation').scrollIntoViewIfNeeded();
      const directSceneCheckbox = page
        .locator('#video-generation label')
        .filter({ hasText: /场景 1/ })
        .locator('input[type="checkbox"]');
      const selectedDirectScene = await clickIfUnchecked(directSceneCheckbox);
      if (!selectedDirectScene) {
        await clickIfUnchecked(page.locator('#video-generation input[type="checkbox"]').first());
      }
      await clickAndWaitForPost(
        page,
        page.locator('#video-generation').getByRole('button', { name: '生成视频任务' }),
        '/video-assets',
        300000
      );
      await waitForBodyText(page, /已创建 \d+ 个视频任务|查看提示词 \/ 豆包命令/, 60000);
    });

    await mark('触发剧本质检并查看质量校验', async () => {
      await clickAndWaitForPost(
        page,
        page.getByRole('button', { name: '质检剧本' }).first(),
        '/quality-reviews',
        300000
      );
      await waitForBodyText(page, /质量校验[\s\S]*(可用级|需修复|AI 味|分)/, 300000);
    });

    const summary = {
      title,
      finalUrl: page.url(),
      steps,
      issues,
      consoleErrors,
      apiResponses: network.map((item) => ({
        method: item.method,
        status: item.status,
        path: item.url.replace(baseUrl, ''),
      })),
    };

    log(`SUMMARY ${JSON.stringify(summary, null, 2)}`);
    await browser.close();

    if (issues.length) process.exit(1);
  } catch (error) {
    await page.screenshot({ path: 'tmp/ai-screenplay-user-story-failure.png', fullPage: true }).catch(() => {});
    log(`SUMMARY ${JSON.stringify({ title, finalUrl: page.url(), steps, issues, consoleErrors }, null, 2)}`);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

main();
