import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { reviewSceneScript } from './script-reviewer';
import { parseScreenplayDialogue } from './script-parser';

export type QualityTargetType = 'script' | 'visual_asset' | 'video';

export interface QualityReviewRequest {
  targetType: QualityTargetType;
  targetId: string;
  run?: boolean;
}

export interface QualityReviewResult {
  passed: boolean;
  score: number;
  aiFeel: 'low' | 'medium' | 'high';
  industryLevel: 'not_usable' | 'rough_internal' | 'ordinary_professional' | 'strong_professional';
  summary: string;
  issues: string[];
  repairInstructions: string;
  checks: Record<string, boolean | string | number | null>;
}

export function normalizeQualityReviewRequest(input: Partial<QualityReviewRequest>): QualityReviewRequest {
  const targetType = input.targetType === 'script' || input.targetType === 'visual_asset' || input.targetType === 'video'
    ? input.targetType
    : 'script';
  return {
    targetType,
    targetId: typeof input.targetId === 'string' ? input.targetId.trim() : '',
    run: input.run !== false,
  };
}

export async function createQualityReviewJob(movieId: string, request: QualityReviewRequest) {
  if (!request.targetId) {
    throw new Error('targetId is required');
  }

  const target = await loadTarget(movieId, request.targetType, request.targetId);
  const job = await prisma.qualityReviewJob.create({
    data: {
      movieId,
      targetType: request.targetType,
      targetId: request.targetId,
      sceneId: target.sceneId,
      visualAssetJobId: target.visualAssetJobId,
      videoGenerationJobId: target.videoGenerationJobId,
      title: target.title,
    },
  });

  if (request.run) {
    executeQualityReviewJob(job.id).catch((error) => {
      console.error(`[QualityReviewJob] ${job.id} failed`, error);
    });
  }

  return job;
}

export async function executeQualityReviewJob(jobId: string): Promise<void> {
  const job = await prisma.qualityReviewJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error(`Quality review job ${jobId} not found`);
  }

  await prisma.qualityReviewJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: new Date(),
      error: null,
    },
  });

  try {
    const result = await reviewTarget(job.movieId, job.targetType as QualityTargetType, job.targetId);
    await prisma.qualityReviewJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        passed: result.passed,
        score: result.score,
        aiFeel: result.aiFeel,
        industryLevel: result.industryLevel,
        summary: result.summary,
        issuesJson: JSON.stringify(result.issues),
        repairInstructions: result.repairInstructions,
        resultJson: JSON.stringify(result),
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.qualityReviewJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        passed: false,
        error: error instanceof Error ? error.message.slice(0, 4000) : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function reviewTarget(
  movieId: string,
  targetType: QualityTargetType,
  targetId: string
): Promise<QualityReviewResult> {
  if (targetType === 'script') return reviewScript(movieId, targetId);
  if (targetType === 'visual_asset') return reviewVisualAsset(movieId, targetId);
  return reviewVideo(movieId, targetId);
}

async function reviewScript(movieId: string, sceneId: string): Promise<QualityReviewResult> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, movieId },
    include: {
      movie: true,
      sceneCharacters: {
        orderBy: { order: 'asc' },
        include: { character: true },
      },
      roundTable: {
        include: {
          rounds: {
            orderBy: { roundNumber: 'asc' },
            include: {
              messages: {
                include: { agent: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      },
    },
  });
  if (!scene) throw new Error('Scene not found');
  if (!scene.finalizedScript?.trim()) {
    return deterministicFailure('剧本尚未生成终稿，无法达到可用级别。', {
      hasFinalScript: false,
    });
  }

  const parsed = parseScreenplayDialogue(scene.finalizedScript);
  const rawDialogue = scene.roundTable.rounds.flatMap((round) =>
    round.messages.map((message) => ({
      roundNumber: round.roundNumber,
      characterName: message.agent.name,
      content: message.content,
    }))
  );
  const llmReview = await reviewSceneScript({
    movieTitle: scene.movie.title,
    sceneHeading: scene.heading,
    sceneDescription: scene.description,
    emotionalGoal: scene.emotionalGoal || '',
    characters: scene.sceneCharacters.map((sc) => ({
      name: sc.character.name,
      backstory: sc.character.backstory,
      personalityTraits: sc.character.personalityTraits,
      surfaceGoal: sc.character.surfaceGoal,
      deepMotivation: sc.character.deepMotivation,
      fatalFlaw: sc.character.fatalFlaw,
      signatureLanguageStyle: sc.character.signatureLanguageStyle,
    })),
    rawDialogue,
    script: scene.finalizedScript,
    attempt: 1,
  });

  const structuralIssues: string[] = [];
  if (scene.finalizedScript.length < 800) structuralIssues.push('剧本长度偏短，可能还只是片段而不是完整场景。');
  if (parsed.dialogues.length < 4) structuralIssues.push('可解析台词块过少，场景冲突可能不充分。');
  if (!scene.sceneCharacters.every((sc) => scene.finalizedScript!.includes(sc.character.name))) {
    structuralIssues.push('并非所有场景角色都在剧本中有明确存在感。');
  }

  const passed = llmReview.passed && structuralIssues.length === 0;
  return {
    passed,
    score: passed ? Math.max(llmReview.score, 8) : Math.min(llmReview.score, 7),
    aiFeel: llmReview.aiFeel,
    industryLevel: passed ? industryLevelFromScore(llmReview.score) : 'rough_internal',
    summary: llmReview.summary,
    issues: [...llmReview.issues, ...structuralIssues],
    repairInstructions: structuralIssues.length
      ? `${llmReview.rewriteInstructions}\n${structuralIssues.join('\n')}`
      : llmReview.rewriteInstructions,
    checks: {
      hasFinalScript: true,
      scriptLength: scene.finalizedScript.length,
      dialogueBlocks: parsed.dialogues.length,
      llmPassed: llmReview.passed,
    },
  };
}

async function reviewVisualAsset(movieId: string, visualAssetJobId: string): Promise<QualityReviewResult> {
  const job = await prisma.visualAssetJob.findFirst({
    where: { id: visualAssetJobId, movieId },
    include: {
      movie: true,
      scene: true,
      character: true,
    },
  });
  if (!job) throw new Error('Visual asset job not found');

  const imagePaths = extractExistingFiles([job.result || '', job.error || ''], ['.png', '.jpg', '.jpeg', '.webp']);
  const llmReview = await reviewPromptArtifact({
    targetKind: 'visual asset',
    title: job.title,
    payload: [
      `Status: ${job.status}`,
      `Asset type: ${job.assetType}`,
      `Movie: ${job.movie.title}`,
      job.scene ? `Scene: ${job.scene.heading}\n${job.scene.contentSummary || job.scene.description}` : '',
      job.character ? `Character: ${job.character.name}\n${job.character.backstory}\n${job.character.personalityTraits}` : '',
      `Image prompt:\n${job.prompt}`,
      job.result ? `Generation result:\n${truncate(job.result, 1600)}` : '',
    ].filter(Boolean).join('\n\n'),
  });

  const readinessIssues: string[] = [];
  if (job.status !== 'completed') readinessIssues.push(`图片任务状态是 ${job.status}，还没有完成的图片产物。`);
  if (imagePaths.length === 0) readinessIssues.push('没有找到可验证的本地图片文件路径，无法确认图片真实生成且可交付。');
  if (job.prompt.length < 700) readinessIssues.push('图片 prompt 信息量不足，可能无法保证角色/场景连续性。');

  return mergeWithReadiness(llmReview, readinessIssues, {
    status: job.status,
    imageFileCount: imagePaths.length,
    promptLength: job.prompt.length,
  });
}

async function reviewVideo(movieId: string, videoGenerationJobId: string): Promise<QualityReviewResult> {
  const job = await prisma.videoGenerationJob.findFirst({
    where: { id: videoGenerationJobId, movieId },
    include: {
      movie: true,
      scene: true,
      visualAssetJob: true,
    },
  });
  if (!job) throw new Error('Video generation job not found');

  const sourceImagePaths = parseJsonArray(job.sourceImagePathsJson).filter((item) => fs.existsSync(item));
  const outputVideos = job.outputDir && fs.existsSync(job.outputDir)
    ? listFilesByExtension(job.outputDir, ['.mp4', '.mov', '.webm'])
    : [];
  const resultVideos = extractExistingFiles([job.result || ''], ['.mp4', '.mov', '.webm']);
  const llmReview = await reviewPromptArtifact({
    targetKind: 'video generation',
    title: job.title,
    payload: [
      `Status: ${job.status}`,
      `Movie: ${job.movie.title}`,
      job.scene ? `Scene: ${job.scene.heading}\n${job.scene.contentSummary || job.scene.description}` : '',
      job.visualAssetJob ? `Visual asset source: ${job.visualAssetJob.title}\n${job.visualAssetJob.prompt}` : '',
      `Ratio: ${job.ratio}`,
      job.durationSeconds ? `Duration: ${job.durationSeconds}s` : '',
      `Video prompt:\n${job.prompt}`,
      job.result ? `Execution result:\n${truncate(job.result, 1600)}` : '',
    ].filter(Boolean).join('\n\n'),
  });

  const readinessIssues: string[] = [];
  if (job.status !== 'completed') readinessIssues.push(`视频任务状态是 ${job.status}，还没有完成的视频产物。`);
  if (outputVideos.length + resultVideos.length === 0) readinessIssues.push('没有找到可验证的视频文件，无法确认已经生成可交付视频。');
  if (job.visualAssetJobId && sourceImagePaths.length === 0) {
    readinessIssues.push('该视频基于图片任务，但没有附带可验证参考图路径，图生视频一致性无法确认。');
  }
  if (job.prompt.length < 900) readinessIssues.push('视频 prompt 信息量不足，可能缺少镜头运动、动作节拍或情绪推进。');

  return mergeWithReadiness(llmReview, readinessIssues, {
    status: job.status,
    sourceImageFileCount: sourceImagePaths.length,
    outputVideoFileCount: outputVideos.length + resultVideos.length,
    promptLength: job.prompt.length,
  });
}

async function loadTarget(movieId: string, targetType: QualityTargetType, targetId: string) {
  if (targetType === 'script') {
    const scene = await prisma.scene.findFirst({ where: { id: targetId, movieId } });
    if (!scene) throw new Error('Scene not found');
    return {
      title: `剧本质检：Scene ${scene.sceneNumber} ${scene.heading}`,
      sceneId: scene.id,
      visualAssetJobId: null,
      videoGenerationJobId: null,
    };
  }
  if (targetType === 'visual_asset') {
    const job = await prisma.visualAssetJob.findFirst({ where: { id: targetId, movieId } });
    if (!job) throw new Error('Visual asset job not found');
    return {
      title: `图片质检：${job.title}`,
      sceneId: job.sceneId,
      visualAssetJobId: job.id,
      videoGenerationJobId: null,
    };
  }
  const job = await prisma.videoGenerationJob.findFirst({ where: { id: targetId, movieId } });
  if (!job) throw new Error('Video generation job not found');
  return {
    title: `视频质检：${job.title}`,
    sceneId: job.sceneId,
    visualAssetJobId: job.visualAssetJobId,
    videoGenerationJobId: job.id,
  };
}

async function reviewPromptArtifact(input: {
  targetKind: string;
  title: string;
  payload: string;
}): Promise<QualityReviewResult> {
  const client = createClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.2,
    max_tokens: 1400,
    messages: [
      {
        role: 'system',
        content: [
          '你是影视行业制片、美术指导、分镜导演和AI视频工作流质检负责人。',
          '你的目标是判断产物是否达到普通影视行业从业者可继续使用的水准，而不是只看文字是否漂亮。',
          '重点识别 AI 味：泛泛高级感、空洞镜头词、缺少具体调度、角色不连续、情绪不落地、不可执行、无可交付文件。',
          '只输出 JSON，不要 markdown。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `请质检这个 ${input.targetKind} 产物。\n\n# 标题\n${input.title}\n\n# 产物内容\n${input.payload}\n\n# 标准\n1. 是否有明确影视行业用途，能被导演/美术/摄影/剪辑/视频生成执行。\n2. 是否具体到角色身份、场景空间、情绪压力、动作节拍、镜头逻辑，而不是 AI 形容词堆砌。\n3. 是否维持剧情、角色、服装、地点、影调连续性。\n4. 是否避免字幕、水印、UI、随机文字、空泛史诗感、模板化电影感。\n5. 如果没有真实文件或任务未完成，不能判定为最终可用，只能评价 prompt 质量。\n\n# 输出 JSON\n{\n  "passed": true,\n  "score": 8,\n  "aiFeel": "low",\n  "industryLevel": "ordinary_professional",\n  "summary": "一句话结论",\n  "issues": ["问题1"],\n  "repairInstructions": "下一步具体修复建议"\n}`,
      },
    ],
  });

  return normalizeReviewResult(response.choices[0]?.message?.content || '');
}

function createClient(): OpenAI {
  const apiKey = process.env.ARK_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.ARK_BASE_URL || process.env.OPENAI_BASE_URL || '';
  if (!apiKey) throw new Error('LLM API key not configured for quality review');
  return new OpenAI({ apiKey, baseURL: baseURL || undefined });
}

function getModel(): string {
  return process.env.DOUBAO_VISION_MODEL || process.env.OPENAI_MODEL_NAME || 'gpt-4o-mini';
}

function normalizeReviewResult(raw: string): QualityReviewResult {
  try {
    const parsed = JSON.parse(extractJson(raw));
    const score = Math.max(0, Math.min(10, Number(parsed.score || 0)));
    const aiFeel = parsed.aiFeel === 'low' || parsed.aiFeel === 'medium' || parsed.aiFeel === 'high'
      ? parsed.aiFeel
      : 'high';
    const industryLevel = isIndustryLevel(parsed.industryLevel)
      ? parsed.industryLevel
      : industryLevelFromScore(score);
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((item: unknown): item is string => typeof item === 'string')
      : [];
    const passed = Boolean(parsed.passed) && score >= 8 && aiFeel !== 'high' && (
      industryLevel === 'ordinary_professional' || industryLevel === 'strong_professional'
    );

    return {
      passed,
      score,
      aiFeel,
      industryLevel,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      issues,
      repairInstructions: typeof parsed.repairInstructions === 'string' ? parsed.repairInstructions : issues.join('\n'),
      checks: {},
    };
  } catch {
    return deterministicFailure(`质检模型返回无法解析: ${truncate(raw, 500)}`, {
      parseableReviewJson: false,
    });
  }
}

function mergeWithReadiness(
  llmReview: QualityReviewResult,
  readinessIssues: string[],
  checks: QualityReviewResult['checks']
): QualityReviewResult {
  const passed = llmReview.passed && readinessIssues.length === 0;
  return {
    ...llmReview,
    passed,
    score: passed ? llmReview.score : Math.min(llmReview.score, 7),
    industryLevel: passed ? llmReview.industryLevel : 'rough_internal',
    issues: [...llmReview.issues, ...readinessIssues],
    repairInstructions: readinessIssues.length
      ? [llmReview.repairInstructions, ...readinessIssues].filter(Boolean).join('\n')
      : llmReview.repairInstructions,
    checks: { ...llmReview.checks, ...checks },
  };
}

function deterministicFailure(summary: string, checks: QualityReviewResult['checks']): QualityReviewResult {
  return {
    passed: false,
    score: 0,
    aiFeel: 'high',
    industryLevel: 'not_usable',
    summary,
    issues: [summary],
    repairInstructions: '先补齐真实生成产物，再重新进行质量校验。',
    checks,
  };
}

function industryLevelFromScore(score: number): QualityReviewResult['industryLevel'] {
  if (score >= 9) return 'strong_professional';
  if (score >= 8) return 'ordinary_professional';
  if (score >= 5) return 'rough_internal';
  return 'not_usable';
}

function isIndustryLevel(value: unknown): value is QualityReviewResult['industryLevel'] {
  return value === 'not_usable' || value === 'rough_internal' || value === 'ordinary_professional' || value === 'strong_professional';
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function extractExistingFiles(values: string[], extensions: string[]): string[] {
  const files = new Set<string>();
  const pattern = new RegExp(`(?:/[^\n\\s"'\\\`]+(?:${extensions.map(escapeRegExp).join('|')}))`, 'gi');
  for (const value of values) {
    const matches = value.match(pattern) || [];
    for (const match of matches) {
      if (fs.existsSync(match) && fs.statSync(match).isFile()) files.add(match);
    }
  }
  return Array.from(files);
}

function listFilesByExtension(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((file) => path.join(dir, file))
    .filter((file) => fs.statSync(file).isFile() && extensions.includes(path.extname(file).toLowerCase()));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
