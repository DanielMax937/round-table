import { chromium } from 'playwright';

const defaultWorkflowUrl = 'http://localhost:8400/movies/cmpv2k9lb001toekz84ci0c1f/workflow';
const workflowUrl = process.env.E2E_WORKFLOW_URL || defaultWorkflowUrl;
const headless = process.env.E2E_HEADLESS !== '0';

const modes = [
  {
    label: '快速模式',
    value: 'quick',
    minVisualJobs: 1,
    minVideoJobs: 1,
    story: '快速模式创建关键帧和视频任务',
  },
  {
    label: '导演模式',
    value: 'director',
    minVisualJobs: 3,
    minVideoJobs: 1,
    story: '导演模式创建关键帧、分镜、环境和视频任务',
  },
  {
    label: '制片模式',
    value: 'producer',
    minVisualJobs: 4,
    minVideoJobs: 1,
    story: '制片模式创建导演包、角色定妆和视频任务',
  },
];

const steps = [];
const issues = [];
const consoleErrors = [];
const apiResponses = [];

function log(message) {
  process.stdout.write(`[pipeline-story] ${message}\n`);
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

async function setCheckboxByLabel(page, section, labelText, checked) {
  const label = section.locator('label').filter({ hasText: labelText }).first();
  const checkbox = label.locator('input[type="checkbox"]').first();

  if ((await checkbox.count()) === 0) {
    throw new Error(`找不到复选框：${labelText}`);
  }

  const current = await checkbox.isChecked();
  if (current !== checked) {
    await label.click();
  }

  await page.waitForFunction(
    ({ labelText: expectedLabel, checked: expectedChecked }) => {
      const labels = Array.from(document.querySelectorAll('#production-pipeline label'));
      const target = labels.find((item) => (item.textContent || '').includes(expectedLabel));
      const input = target?.querySelector('input[type="checkbox"]');
      return input instanceof HTMLInputElement && input.checked === expectedChecked;
    },
    { labelText, checked },
    { timeout: 5000 }
  );
}

async function ensureFirstSceneSelected(section) {
  const firstSceneCheckbox = section.locator('label').filter({ hasText: /场景 1/ }).locator('input[type="checkbox"]').first();
  if ((await firstSceneCheckbox.count()) === 0) {
    throw new Error('找不到场景 1 复选框');
  }
  if (!(await firstSceneCheckbox.isChecked())) {
    await firstSceneCheckbox.click();
  }
}

function assertPipelineResult(mode, payload) {
  const run = payload?.run;
  if (!run) throw new Error('流水线响应缺少 run');
  if (run.level !== mode.value) {
    throw new Error(`模式不匹配：期望 ${mode.value}，实际 ${run.level}`);
  }
  if (run.status !== 'completed') {
    throw new Error(`流水线未完成：${run.status}`);
  }

  const scenes = Array.isArray(run.result?.scenes) ? run.result.scenes : [];
  if (!scenes.length) throw new Error('流水线结果缺少 scenes');
  const firstScene = scenes[0];
  const visualCount = Array.isArray(firstScene.visualAssetJobIds) ? firstScene.visualAssetJobIds.length : 0;
  const videoCount = Array.isArray(firstScene.videoGenerationJobIds) ? firstScene.videoGenerationJobIds.length : 0;
  if (visualCount < mode.minVisualJobs) {
    throw new Error(`${mode.label} 视觉任务不足：期望 >= ${mode.minVisualJobs}，实际 ${visualCount}`);
  }
  if (videoCount < mode.minVideoJobs) {
    throw new Error(`${mode.label} 视频任务不足：期望 >= ${mode.minVideoJobs}，实际 ${videoCount}`);
  }

  return {
    runId: run.id,
    level: run.level,
    status: run.status,
    visualCount,
    videoCount,
  };
}

async function main() {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('response', (response) => {
    if (response.url().includes('/api/movies')) {
      apiResponses.push({
        method: response.request().method(),
        status: response.status(),
        url: response.url(),
      });
    }
  });

  try {
    await mark('打开已有工作流页', async () => {
      await page.goto(workflowUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('#production-pipeline').scrollIntoViewIfNeeded();
      await page.getByText('自动产制流水线').waitFor({ timeout: 60000 });
    });

    for (const mode of modes) {
      await mark(mode.story, async () => {
        const section = page.locator('#production-pipeline');
        await section.scrollIntoViewIfNeeded();
        await section.getByRole('button', { name: new RegExp(mode.label) }).click();
        await ensureFirstSceneSelected(section);
        await setCheckboxByLabel(page, section, '自动 LLM 质检', false);
        await setCheckboxByLabel(page, section, '同步执行图片生成', false);
        await setCheckboxByLabel(page, section, '同步执行豆包视频', false);
        await section.locator('textarea').fill(`E2E ${mode.label}：只创建任务，不执行外部图片和视频生成。`);
        await page.waitForTimeout(250);

        const responsePromise = page.waitForResponse((response) =>
          response.url().includes('/production-pipeline') &&
          response.request().method() === 'POST',
          { timeout: 420000 }
        );
        await section.getByRole('button', { name: '运行产制流水线' }).click();
        const response = await responsePromise;
        if (!response.ok()) {
          throw new Error(`/production-pipeline returned HTTP ${response.status()}`);
        }

        const payload = await response.json();
        const result = assertPipelineResult(mode, payload);
        await page.waitForFunction(
          (label) => (document.body.innerText || '').includes(label),
          mode.label,
          { timeout: 60000 }
        );
        return result;
      });
    }

    const summary = {
      workflowUrl,
      steps,
      issues,
      consoleErrors,
      pipelinePosts: apiResponses
        .filter((item) => item.method === 'POST' && item.url.includes('/production-pipeline'))
        .map((item) => ({ status: item.status, path: item.url.replace(/^https?:\/\/[^/]+/, '') })),
    };
    log(`SUMMARY ${JSON.stringify(summary, null, 2)}`);
    await browser.close();
    if (issues.length) process.exit(1);
  } catch (error) {
    await page.screenshot({ path: 'tmp/production-pipeline-modes-failure.png', fullPage: true }).catch(() => {});
    log(`SUMMARY ${JSON.stringify({ workflowUrl, steps, issues, consoleErrors }, null, 2)}`);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

main();
