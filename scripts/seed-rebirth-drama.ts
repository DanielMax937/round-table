#!/usr/bin/env tsx
/**
 * 爆款短剧《重生后，霸总女儿逼我谈恋爱》剧本创作启动脚本
 *
 * 用法：
 *   1. 确保 round-table 开发服务已启动: npm run dev
 *   2. 运行: npx tsx scripts/seed-rebirth-drama.ts
 *
 * 将创建电影、设置主题、确认故事、生成角色，并进入大纲阶段。
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8400';

const PROPOSAL = {
  title: '重生后，霸总女儿逼我谈恋爱',
  titleAlt: '我的20岁硬核村花老妈 / 满级老妈重返二十岁',
  theme: `爆款短剧提案：《重生后，霸总女儿逼我谈恋爱》
（备选剧名：《我的20岁硬核村花老妈》、《满级老妈重返二十岁》）

核心概念（Logline）：
身价过亿的女总裁林宛在亡母忌日，意外迎来了穿越回20岁、操着一口乡音的亲妈李秀琴。林宛狂砸千金，誓要给早逝的母亲安排最奢华的生活和最完美的爱情；然而，没读过几天书却拥有"铁娘子"手腕的秀琴，不仅把高端相亲局搅成了农副产品交流会，还用最野蛮粗暴的"村镇智慧"，帮女儿杀穿了阴险狡诈的现代商战。

人物小传：
- 林宛（28岁，女儿）—— "提款机"霸总
  表层设定：杀伐果断的上市集团女CEO，信仰"钱能解决一切"，重度缺乏安全感。
  深层动机：痛恨早逝的母亲一天福都没享过。发誓要用尽所有的财力和资源，把年轻的母亲宠成十指不沾阳春水的小公主，替她找个绝世好男人。

- 李秀琴（外表20岁，心理55岁，妈妈）—— "村镇董明珠"
  表层设定：顶着一张20岁清纯村花的脸，水灵透彻。
  深层性格：80年代底层摸爬滚打出来的女强人。没文化但极具商业嗅觉，极其抠门（护财），极其护犊子。看不起一切虚头巴脑的PPT和资本游戏，信奉"欠债还钱"、"一手交钱一手交货"。

剧情大纲（25集短剧）：
第一阶段（1-5集）：天降村花，霸总的"娇养"计划崩盘。身份倒错的爆笑认亲，消费观的极致碰撞。
第二阶段（6-12集）：太后选妃，降维打击现代高质量男性。用农村实用主义眼光审视相亲局。
第三阶段（13-20集）："铁娘子"出山，泥土智慧血洗CBD。代工厂危机、催债风波、整顿董事会。
第四阶段（21-25集）：大结局，爱是双向的守护。婚礼反转，母女以闺蜜/搭档身份继续大杀四方。`,
  storyProposal: {
    oneLiner:
      '身价过亿的女总裁林宛在亡母忌日迎来穿越回20岁的亲妈李秀琴，狂砸千金想宠妈找男人，却被"村镇董明珠"用土味智慧搅乱相亲局、血洗商战。',
    coreConflict:
      '母女代际与价值观的极致碰撞：女儿用金钱补偿母爱 vs 母亲用底层智慧守护女儿；消费主义 vs 实用主义；现代资本游戏 vs 农村江湖义气。',
    styleReference: '短剧爆款、都市喜剧、重生爽文、母女双强',
    synopsis: `林宛在亡母忌日回家，发现穿着高定礼服、拿祖母绿项链捣蒜的20岁少女——竟是穿越回来的亲妈李秀琴。通过私密细节相认后，林宛开启疯狂尽孝：米其林被嫌弃，爱马仕装大葱。林宛安排顶流男爱豆、海归金融男相亲，秀琴用"配种/买卖"眼光审视，把所有人折服。公司面临代工厂罢工、网红赖账、资本吞并，秀琴拎二锅头拜把子、睡办公室门口、砸合同护女，泥土智慧大杀四方。婚礼当天秀琴跑回女儿办公室，端出荷包蛋清汤面："妈回来不是为了找男人，是想亲眼看看我保下来的小丫头当大老板有多威风。"母女以新身份继续征战商场。`,
  },
};

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { method: 'GET' }).catch(() => null);
    return res?.ok ?? false;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🎬 爆款短剧《重生后，霸总女儿逼我谈恋爱》剧本创作启动\n');
  console.log(`📍 API 地址: ${BASE_URL}\n`);

  const ok = await checkServer();
  if (!ok) {
    console.error('❌ 开发服务未启动！请先运行: npm run dev');
    console.error('   服务默认端口: 8400\n');
    process.exit(1);
  }
  console.log('✅ 服务已就绪\n');

  let movieId: string;

  try {
    // 1. 创建电影
    console.log('📌 Step 1: 创建电影项目...');
    const createRes = await fetch(`${BASE_URL}/api/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: PROPOSAL.title,
        description: PROPOSAL.titleAlt,
        theme: PROPOSAL.theme,
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(JSON.stringify(err));
    }
    const { movie } = await createRes.json();
    movieId = movie.id;
    console.log(`   ✅ 已创建: ${movie.title} (ID: ${movieId})\n`);

    // 2. 确认故事（直接使用提案，跳过 AI 生成）
    console.log('📌 Step 2: 确认故事提案...');
    const confirmRes = await fetch(`${BASE_URL}/api/movies/${movieId}/confirm-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal: PROPOSAL.storyProposal }),
    });
    if (!confirmRes.ok) {
      const err = await confirmRes.json();
      throw new Error(JSON.stringify(err));
    }
    console.log('   ✅ 故事已确认\n');

    // 3. 生成角色
    console.log('📌 Step 3: 生成角色档案（调用 AI）...');
    const charRes = await fetch(`${BASE_URL}/api/movies/${movieId}/characters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!charRes.ok) {
      const err = await charRes.json();
      throw new Error(JSON.stringify(err));
    }
    const { characters } = await charRes.json();
    console.log(`   ✅ 已生成 ${characters?.length ?? 0} 个角色\n`);

    // 4. 确认角色（自动进入大纲阶段）
    console.log('📌 Step 4: 确认角色...');
    const confirmCharRes = await fetch(`${BASE_URL}/api/movies/${movieId}/confirm-characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!confirmCharRes.ok) {
      const err = await confirmCharRes.json();
      throw new Error(JSON.stringify(err));
    }
    console.log('   ✅ 角色已确认\n');

    // 5. 生成大纲
    console.log('📌 Step 5: 生成场景大纲（调用 AI）...');
    const outlineRes = await fetch(`${BASE_URL}/api/movies/${movieId}/outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!outlineRes.ok) {
      const err = await outlineRes.json();
      throw new Error(JSON.stringify(err));
    }
    const { outlines } = await outlineRes.json();
    console.log(`   ✅ 已生成 ${outlines?.length ?? 0} 个场景大纲\n`);

    // 6. 确认大纲
    console.log('📌 Step 6: 确认大纲...');
    const confirmOutlineRes = await fetch(`${BASE_URL}/api/movies/${movieId}/confirm-outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!confirmOutlineRes.ok) {
      const err = await confirmOutlineRes.json();
      throw new Error(JSON.stringify(err));
    }
    console.log('   ✅ 大纲已确认\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 剧本创作项目已就绪！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📂 工作流页面: ${BASE_URL}/movies/${movieId}/workflow`);
    console.log(`📂 电影详情:   ${BASE_URL}/movies/${movieId}\n`);
    console.log('下一步：在页面上逐个执行场景生成，或通过 API 调用：');
    console.log(`  POST ${BASE_URL}/api/movies/${movieId}/scenes/execute`);
    console.log('  body: { "outlineIndex": 0 }  // 从 0 开始\n');
  } catch (e) {
    console.error('\n❌ 执行失败:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
