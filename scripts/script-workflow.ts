#!/usr/bin/env tsx
/**
 * 剧本创作交互式工作流 - 按步骤调用 API
 *
 * 用法：
 *   npx tsx scripts/script-workflow.ts create-theme "<主题内容>" [标题]
 *   npx tsx scripts/script-workflow.ts update-theme "<修改后的主题>"
 *   npx tsx scripts/script-workflow.ts approve              # 同意，执行下一步
 *   npx tsx scripts/script-workflow.ts status              # 查看当前状态
 *
 * 需先启动服务: npm run dev
 * 通过 SCRIPT_MOVIE_ID 或 .script-workflow.json 传递 movieId
 */

const BASE = process.env.BASE_URL || 'http://localhost:8400';
const STATE_FILE = '.script-workflow.json';

interface State {
  movieId: string;
  title?: string;
}

async function loadState(): Promise<State | null> {
  const id = process.env.SCRIPT_MOVIE_ID;
  if (id) return { movieId: id };
  try {
    const fs = await import('fs');
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(data) as State;
  } catch {
    return null;
  }
}

async function saveState(s: State) {
  const fs = await import('fs');
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

async function fetchApi(
  method: string,
  path: string,
  body?: object
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const url = `${BASE}${path}`;
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || data.details || res.statusText };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd) {
    console.log(`
剧本创作工作流 - 交互式 API 调用

命令:
  create-theme "<主题>" [标题]          创建电影并设置主题
  create-theme --file <路径> [标题]     从文件读取主题
  update-theme "<主题>"                 修改当前电影主题
  approve                              同意当前步骤，执行下一步
  confirm-story 0|1|2                  确认选中的故事提案
  confirm-story-custom <JSON文件>      用自定义提案确认（跳过AI生成）
  confirm-characters                    确认角色
  confirm-outline                       确认大纲
  status                                查看工作流状态
  execute-scene [N]                      执行下一场景 (N=outlineIndex，默认自动取下一个)

流程: 创建主题 → 同意(生成提案) → 确认故事 → 同意(生成角色) → 同意(确认角色) → 同意(生成大纲) → 同意(确认大纲) → 场景执行

示例:
  npm run workflow create-theme "都市喜剧，母女穿越..."
  npm run workflow approve
  npm run workflow status
`);
    process.exit(0);
  }

  if (cmd === 'create-theme') {
    let theme: string;
    let title = '未命名剧本';
    if (args[0] === '--file') {
      const path = args[1];
      if (!path) {
        console.error('请提供文件路径: create-theme --file <path> [标题]');
        process.exit(1);
      }
      const fs = await import('fs');
      theme = fs.readFileSync(path, 'utf-8').trim();
      title = args[2] || path.replace(/\.[^/.]+$/, '').split('/').pop() || '未命名剧本';
    } else {
      theme = args[0] || '';
      title = args[1] || title;
      if (!theme.trim()) {
        console.error('请提供主题内容，或使用: create-theme --file <路径> [标题]');
        process.exit(1);
      }
    }
    const r = await fetchApi('POST', '/api/movies', { title, theme });
    if (!r.ok) {
      console.error('创建失败:', r.error);
      process.exit(1);
    }
    const movieId = r.data!.movie.id;
    await saveState({ movieId, title });
    console.log('✅ 主题已创建');
    console.log('   movieId:', movieId);
    console.log('   标题:', r.data!.movie.title);
    console.log('\n请审阅主题，同意则运行: npx tsx scripts/script-workflow.ts approve');
    console.log('需修改则运行: npx tsx scripts/script-workflow.ts update-theme "<新主题>"');
    return;
  }

  const state = await loadState();
  if (!state?.movieId) {
    console.error('未找到 movieId。请先运行 create-theme 或设置 SCRIPT_MOVIE_ID');
    process.exit(1);
  }
  const { movieId } = state;

  if (cmd === 'update-theme') {
    const theme = args[0];
    if (!theme?.trim()) {
      console.error('请提供修改后的主题内容');
      process.exit(1);
    }
    const r = await fetchApi('PUT', `/api/movies/${movieId}/theme`, { theme: theme.trim() });
    if (!r.ok) {
      console.error('修改失败:', r.error);
      process.exit(1);
    }
    console.log('✅ 主题已更新');
    console.log('\n请审阅，同意则运行: npx tsx scripts/script-workflow.ts approve');
    return;
  }

  if (cmd === 'status') {
    const r = await fetchApi('GET', `/api/movies/${movieId}/workflow`);
    if (!r.ok) {
      console.error('获取状态失败:', r.error);
      process.exit(1);
    }
    const w = r.data!;
    console.log('工作流状态:');
    console.log('  阶段:', w.workflowPhase);
    console.log('  有故事提案:', w.hasStoryProposals);
    console.log('  已确认故事:', w.hasConfirmedStory);
    console.log('  角色数:', w.characterCount);
    console.log('  大纲数:', w.outlineCount);
    console.log('  场景数:', w.sceneCount);
    console.log('  可导出:', w.canExport);
    return;
  }

  if (cmd === 'approve') {
    const wRes = await fetchApi('GET', `/api/movies/${movieId}/workflow`);
    if (!wRes.ok) {
      console.error('获取状态失败:', wRes.error);
      process.exit(1);
    }
    const w = wRes.data!;
    const phase = w.workflowPhase;
    const hasProposals = w.hasStoryProposals;
    const hasStory = w.hasConfirmedStory;
    const charCount = w.characterCount ?? 0;
    const outlineCount = w.outlineCount ?? 0;

    if (phase === 'theme' || (phase === 'proposals' && !hasProposals)) {
      const pRes = await fetchApi('POST', `/api/movies/${movieId}/story-proposals`);
      if (!pRes.ok) {
        console.error('生成提案失败:', pRes.error);
        process.exit(1);
      }
      const proposals = pRes.data!.proposals || [];
      console.log('✅ 已生成 3 个故事提案:');
      proposals.forEach((p: any, i: number) => {
        console.log(`   ${i + 1}. ${p.oneLiner}`);
      });
      console.log('\n请选择其一确认:');
      console.log('  npx tsx scripts/script-workflow.ts confirm-story 0   # 选第 1 个');
      console.log('  npx tsx scripts/script-workflow.ts confirm-story 1   # 选第 2 个');
      console.log('  npx tsx scripts/script-workflow.ts confirm-story 2   # 选第 3 个');
      return;
    }

    if (phase === 'proposals' && hasProposals && !hasStory) {
      console.log('已有故事提案，请选择确认:');
      console.log('  npx tsx scripts/script-workflow.ts confirm-story 0|1|2');
      return;
    }

    if (phase === 'characters' && charCount === 0) {
      const cRes = await fetchApi('POST', `/api/movies/${movieId}/characters/generate`);
      if (!cRes.ok) {
        console.error('生成角色失败:', cRes.error);
        process.exit(1);
      }
      const chars = cRes.data!.characters || [];
      console.log('✅ 已生成', chars.length, '个角色:');
      chars.forEach((c: any) => console.log('   -', c.name, ':', (c.surfaceGoal || '').slice(0, 40) + '...'));
      console.log('\n请审阅角色，同意则运行: npx tsx scripts/script-workflow.ts approve');
      return;
    }

    if (phase === 'characters' && charCount > 0) {
      const r = await fetchApi('POST', `/api/movies/${movieId}/confirm-characters`);
      if (!r.ok) {
        console.error('确认角色失败:', r.error);
        process.exit(1);
      }
      console.log('✅ 角色已确认');
      console.log('\n下一步: 生成大纲');
      console.log('  npx tsx scripts/script-workflow.ts approve');
      return;
    }

    if (phase === 'outline' && outlineCount === 0) {
      const oRes = await fetchApi('POST', `/api/movies/${movieId}/outline`);
      if (!oRes.ok) {
        console.error('生成大纲失败:', oRes.error);
        process.exit(1);
      }
      const outlines = oRes.data!.outlines || [];
      console.log('✅ 已生成', outlines.length, '个场景大纲:');
      outlines.forEach((o: any, i: number) => console.log(`   ${i + 1}. ${o.title}`));
      console.log('\n请审阅大纲，同意则运行: npx tsx scripts/script-workflow.ts approve');
      return;
    }

    if (phase === 'outline' && outlineCount > 0) {
      const r = await fetchApi('POST', `/api/movies/${movieId}/confirm-outline`);
      if (!r.ok) {
        console.error('确认大纲失败:', r.error);
        process.exit(1);
      }
      console.log('✅ 大纲已确认');
      console.log('\n下一步: 按顺序执行场景生成');
      return;
    }

    if (phase === 'scene_execution') {
      console.log('当前阶段: 场景执行。请按顺序执行:');
      console.log('  POST /api/movies/' + movieId + '/scenes/execute');
      console.log('  body: { "outlineIndex": 0 }  // 从 0 开始递增');
      return;
    }

    console.log('当前阶段:', phase, '- 无自动下一步');
    return;
  }

  if (cmd === 'confirm-story') {
    const idx = parseInt(args[0], 10);
    if (isNaN(idx) || idx < 0 || idx > 2) {
      console.error('请提供提案索引 0、1 或 2');
      process.exit(1);
    }
    const r = await fetchApi('POST', `/api/movies/${movieId}/confirm-story`, {
      proposalIndex: idx,
    });
    if (!r.ok) {
      console.error('确认故事失败:', r.error);
      process.exit(1);
    }
    console.log('✅ 故事已确认');
    console.log('\n下一步: 生成角色');
    console.log('  npx tsx scripts/script-workflow.ts approve');
    return;
  }

  if (cmd === 'confirm-characters') {
    const r = await fetchApi('POST', `/api/movies/${movieId}/confirm-characters`);
    if (!r.ok) {
      console.error('确认角色失败:', r.error);
      process.exit(1);
    }
    console.log('✅ 角色已确认');
    console.log('\n下一步: 生成大纲');
    console.log('  npx tsx scripts/script-workflow.ts approve');
    return;
  }

  if (cmd === 'confirm-outline') {
    const r = await fetchApi('POST', `/api/movies/${movieId}/confirm-outline`);
    if (!r.ok) {
      console.error('确认大纲失败:', r.error);
      process.exit(1);
    }
    console.log('✅ 大纲已确认');
    console.log('\n下一步: 按顺序执行场景生成');
    return;
  }

  if (cmd === 'confirm-story-custom') {
    const path = args[0];
    if (!path) {
      console.error('用法: confirm-story-custom <提案JSON文件路径>');
      console.error('JSON 格式: { "oneLiner", "coreConflict", "styleReference", "synopsis" }');
      process.exit(1);
    }
    const fs = await import('fs');
    const raw = fs.readFileSync(path, 'utf-8');
    const proposal = JSON.parse(raw);
    const r = await fetchApi('POST', `/api/movies/${movieId}/confirm-story`, {
      proposal,
    });
    if (!r.ok) {
      console.error('确认故事失败:', r.error);
      process.exit(1);
    }
    console.log('✅ 故事已确认（自定义提案）');
    console.log('\n下一步: 生成角色');
    console.log('  npx tsx scripts/script-workflow.ts approve');
    return;
  }

  if (cmd === 'execute-scene') {
    let outlineIndex: number;
    if (args[0] !== undefined) {
      outlineIndex = parseInt(args[0], 10);
      if (isNaN(outlineIndex) || outlineIndex < 0) {
        console.error('请提供有效的 outlineIndex（0 或正整数）');
        process.exit(1);
      }
    } else {
      const wRes = await fetchApi('GET', `/api/movies/${movieId}/workflow`);
      if (!wRes.ok) {
        console.error('获取工作流状态失败:', wRes.error);
        process.exit(1);
      }
      const sceneCount = (wRes.data as { sceneCount?: number })?.sceneCount ?? 0;
      outlineIndex = sceneCount;
      console.log('当前已生成', sceneCount, '个场景，执行 outlineIndex =', outlineIndex);
    }
    console.log('正在生成场景', outlineIndex + 1, '（LLM 约需 1–3 分钟）...');
    const r = await fetchApi('POST', `/api/movies/${movieId}/scenes/execute`, {
      outlineIndex,
    });
    if (!r.ok) {
      console.error('场景生成失败:', r.error);
      process.exit(1);
    }
    const data = r.data as { sceneId?: string; fullScript?: string };
    console.log('✅ 场景已生成');
    if (data?.sceneId) console.log('   sceneId:', data.sceneId);
    if (data?.fullScript) console.log('   剧本预览:', data.fullScript.slice(0, 200) + '...');
    console.log('\n请审阅（Telegram 已推送）。可反馈重写或执行下一场景:');
    console.log('  npx tsx scripts/script-workflow.ts execute-scene');
    return;
  }

  console.error('未知命令:', cmd);
  process.exit(1);
}

main();
