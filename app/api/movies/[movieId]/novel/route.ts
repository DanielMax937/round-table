import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';
import { getScenesByMovie } from '@/lib/db/scenes';
import {
  createNovelJob,
  getNovelJob,
  updateNovelJob,
} from '@/lib/db/novel-jobs';
import { reviewNovelChapter, repairNovelChapter } from '@/lib/movie/novel-reviewer';
import {
  formatDevelopmentContext,
  parseDevelopmentReport,
  parseStoryBible,
} from '@/lib/movie/development';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export const maxDuration = 600;

/**
 * POST: Start novel conversion job
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;

    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: '电影项目不存在' }, { status: 404 });
    }

    const scenes = await getScenesByMovie(movieId);
    const confirmedScenes = scenes.filter(
      s => (s.status === 'confirmed' || s.status === 'finalized') && s.finalizedScript
    );

    if (confirmedScenes.length === 0) {
      return NextResponse.json(
        { error: '没有找到已定稿场景。请先完成场景生成。' },
        { status: 400 }
      );
    }

    // Create job record
    const job = await createNovelJob({ movieId });

    // Start background conversion
    runNovelConversion(job.id, movieId).catch(error => {
      console.error('[Novel] Background conversion failed:', error);
    });

    return NextResponse.json(
      {
        jobId: job.id,
        status: 'pending',
        totalChapters: confirmedScenes.length,
        message: 'Novel conversion started. Poll GET /api/movies/[movieId]/novel?jobId=... for status.',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[Novel] Error starting conversion:', error);
    return NextResponse.json(
      { error: '启动小说改编失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * GET: Poll job status or get result
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      // List all jobs for this movie
      const { getNovelJobsByMovie } = await import('@/lib/db/novel-jobs');
      const jobs = await getNovelJobsByMovie(movieId);
      return NextResponse.json({ jobs });
    }

    const job = await getNovelJob(jobId);
    if (!job) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    if (job.movieId !== movieId) {
      return NextResponse.json({ error: '任务不属于当前电影项目' }, { status: 400 });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        currentChapter: job.currentChapter,
        totalChapters: job.totalChapters,
        result: job.status === 'completed' ? job.result : undefined,
        chaptersJson: job.status === 'completed' ? job.chaptersJson : undefined,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error) {
    console.error('[Novel] Error polling job:', error);
    return NextResponse.json(
      { error: '轮询任务失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * Background novel conversion with review/repair loop
 */
async function runNovelConversion(jobId: string, movieId: string) {
  const { prisma } = await import('@/lib/prisma');

  try {
    await updateNovelJob(jobId, { status: 'running', startedAt: new Date() });

    // Get movie with all data
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      include: {
        characters: true,
        scenes: {
          where: {
            status: { in: ['confirmed', 'finalized'] },
            finalizedScript: { not: null },
          },
          orderBy: { sceneNumber: 'asc' },
          include: {
            sceneOutline: true,
            sceneCharacters: {
              include: { character: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!movie) throw new Error('电影项目不存在');
    if (movie.scenes.length === 0) throw new Error('没有找到已定稿场景');

    const totalChapters = movie.scenes.length;
    await updateNovelJob(jobId, { totalChapters });

    const chapters: Array<{ chapterNumber: number; title: string; content: string }> = [];
    const developmentReport = parseDevelopmentReport(movie.developmentReportJson);
    const storyBible = parseStoryBible(movie.storyBibleJson);

    for (let i = 0; i < totalChapters; i++) {
      const scene = movie.scenes[i];
      const chapterNumber = i + 1;

      await updateNovelJob(jobId, { currentChapter: chapterNumber });

      // Build character list
      const sceneCharacters = scene.sceneCharacters.map(sc => ({
        name: sc.character.name,
        backstory: sc.character.backstory,
        personalityTraits: sc.character.personalityTraits,
        surfaceGoal: sc.character.surfaceGoal || undefined,
        deepMotivation: sc.character.deepMotivation || undefined,
        fatalFlaw: sc.character.fatalFlaw || undefined,
        signatureLanguageStyle: sc.character.signatureLanguageStyle || undefined,
      }));

      // Build previous chapters context
      const previousChapters = chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        content: ch.content,
      }));

      const input = {
        movieTitle: movie.title,
        sceneHeading: scene.heading,
        sceneDescription: scene.description,
        contentSummary: scene.contentSummary || undefined,
        emotionalGoal: scene.emotionalGoal || undefined,
        characters: sceneCharacters,
        screenplay: scene.finalizedScript || '',
        developmentReport,
        storyBible,
        scenePlanning: scene.sceneOutline ? {
          act: scene.sceneOutline.act,
          arcName: scene.sceneOutline.arcName,
          arcGoal: scene.sceneOutline.arcGoal,
          setupPayoff: scene.sceneOutline.setupPayoff,
          requiredMotif: scene.sceneOutline.requiredMotif,
        } : null,
        previousChapters,
        chapterNumber,
      };

      // Convert with review/repair loop
      const chapter = await convertWithReview(input);
      chapters.push(chapter);

      // Update job with progress
      await updateNovelJob(jobId, {
        chaptersJson: JSON.stringify(chapters),
      });
    }

    // Assemble full novel
    const fullNovel = assembleNovel(movie.title, chapters);

    await updateNovelJob(jobId, {
      status: 'completed',
      result: fullNovel,
      chaptersJson: JSON.stringify(chapters),
      completedAt: new Date(),
    });

    console.log(`[Novel] Conversion completed for movie ${movieId}: ${chapters.length} chapters`);
  } catch (error) {
    console.error('[Novel] Conversion failed:', error);
    await updateNovelJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : '未知错误',
      completedAt: new Date(),
    });
  }
}

/**
 * Convert a single chapter with review/repair loop
 */
async function convertWithReview(
  input: {
    movieTitle: string;
    sceneHeading: string;
    sceneDescription: string;
    contentSummary?: string;
    emotionalGoal?: string;
    characters: Array<{
      name: string;
      backstory: string;
      personalityTraits?: string;
      surfaceGoal?: string;
      deepMotivation?: string;
      fatalFlaw?: string;
      signatureLanguageStyle?: string;
    }>;
    screenplay: string;
    developmentReport?: ReturnType<typeof parseDevelopmentReport>;
    storyBible?: ReturnType<typeof parseStoryBible>;
    scenePlanning?: {
      act?: string | null;
      arcName?: string | null;
      arcGoal?: string | null;
      setupPayoff?: string | null;
      requiredMotif?: string | null;
    } | null;
    previousChapters: Array<{ chapterNumber: number; title: string; content: string }>;
    chapterNumber: number;
  },
  maxAttempts: number = 3
) {
  const { convertScriptToNovel } = await import('@/lib/movie/novel-converter');
  const { reviewSubversive } = await import('@/lib/movie/subversive-reviewer');

  let currentChapter = await convertScriptToNovel(input);
  let lastReview: { passed: boolean; score: number; summary: string; issues: string[]; rewriteInstructions: string } | null = null;
  let bestChapter = currentChapter;
  let bestScore = -1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const developmentContext = buildNovelDevelopmentContext(input);

    // Review 1: 基础质量审查
    const reviewInput = {
      movieTitle: input.movieTitle,
      chapterNumber: input.chapterNumber,
      chapterTitle: currentChapter.title,
      chapterContent: currentChapter.content,
      developmentContext,
      characters: input.characters,
    };

    const review = await reviewNovelChapter(reviewInput);
    lastReview = review;
    if (review.score > bestScore) {
      bestScore = review.score;
      bestChapter = currentChapter;
    }

    // Review 2: 颠覆审查（只有基础审查通过才执行）
    let subversivePassed = false;
    let subversiveSummary = '';
    let subversiveIssues: string[] = [];
    let subversiveSuggestions: string[] = [];

    if (review.passed) {
      const subversiveReview = await reviewSubversive({
        movieTitle: input.movieTitle,
        sceneHeading: `第${input.chapterNumber}章 ${currentChapter.title}`,
        sceneDescription: input.sceneDescription,
        script: currentChapter.content,
        characters: input.characters.map(c => ({
          name: c.name,
          personalityTraits: c.personalityTraits,
          fatalFlaw: c.fatalFlaw,
        })),
      });
      subversivePassed = subversiveReview.passed;
      subversiveSummary = subversiveReview.summary;
      subversiveIssues = subversiveReview.issues;
      subversiveSuggestions = subversiveReview.suggestions;
    }

    // 两个审查都必须通过
    const allPassed = review.passed && subversivePassed;

    if (allPassed) {
      console.log(`[Novel] Chapter ${input.chapterNumber} passed all reviews (quality: ${review.score}, subversive: ${subversivePassed})`);

      return currentChapter;
    }

    // 合并两个审查的反馈
    const feedbacks: string[] = [];
    if (!review.passed) {
      feedbacks.push(`【质量审查】评分: ${review.score}/10\n问题: ${review.issues.join('；')}\n修复指令: ${review.rewriteInstructions}`);
    }
    if (!subversivePassed) {
      feedbacks.push(`【颠覆审查】${subversiveSummary}\n问题: ${subversiveIssues.join('；')}\n建议: ${subversiveSuggestions.join('；')}`);
    }
    const combinedFeedback = feedbacks.join('\n\n');

    console.log(`[Novel] Chapter ${input.chapterNumber} failed review (quality: ${review.passed}, subversive: ${subversivePassed}), attempt ${attempt + 1}/${maxAttempts}`);

    // If not last attempt, repair and retry
    if (attempt < maxAttempts - 1) {
      // 将颠覆审查反馈注入修复指令
      const enhancedReview = {
        ...review,
        rewriteInstructions: [
          review.rewriteInstructions,
          combinedFeedback ? `完整合并反馈：\n${combinedFeedback}` : '',
        ].filter(Boolean).join('\n\n'),
      };
      const repairedContent = await repairNovelChapter(reviewInput, enhancedReview);
      currentChapter = normalizeRepairedChapter(currentChapter, repairedContent);
    }
  }

  // Return highest-scoring result even if review failed.
  console.log(`[Novel] Chapter ${input.chapterNumber} using best result after ${maxAttempts} attempts${lastReview ? ` (last score: ${lastReview.score})` : ''}`);
  return bestChapter;
}

function assembleNovel(title: string, chapters: Array<{ chapterNumber: number; title: string; content: string }>): string {
  let novel = `${title}\n\n`;

  for (const chapter of chapters) {
    novel += `${chapter.title}\n\n`;
    novel += `${chapter.content}\n\n\n`;
  }

  return novel.trim();
}

function normalizeRepairedChapter(
  previous: { chapterNumber: number; title: string; content: string },
  repairedContent: string
) {
  const cleaned = repairedContent.trim();
  const lines = cleaned.split('\n');
  const firstLine = lines[0]?.trim() || '';
  if (firstLine && (firstLine.startsWith('第') || firstLine.startsWith('Chapter')) && firstLine.length < 40) {
    return {
      chapterNumber: previous.chapterNumber,
      title: firstLine,
      content: lines.slice(1).join('\n').trim(),
    };
  }
  return {
    ...previous,
    content: cleaned,
  };
}

function buildNovelDevelopmentContext(input: {
  developmentReport?: ReturnType<typeof parseDevelopmentReport>;
  storyBible?: ReturnType<typeof parseStoryBible>;
  scenePlanning?: {
    act?: string | null;
    arcName?: string | null;
    arcGoal?: string | null;
    setupPayoff?: string | null;
    requiredMotif?: string | null;
  } | null;
}) {
  const scenePlanning = [
    input.scenePlanning?.act ? `幕/阶段：${input.scenePlanning.act}` : null,
    input.scenePlanning?.arcName ? `叙事弧线：${input.scenePlanning.arcName}` : null,
    input.scenePlanning?.arcGoal ? `弧线目标：${input.scenePlanning.arcGoal}` : null,
    input.scenePlanning?.setupPayoff ? `本章埋设/回收：${input.scenePlanning.setupPayoff}` : null,
    input.scenePlanning?.requiredMotif ? `本章必须出现的物件/空间/动作：${input.scenePlanning.requiredMotif}` : null,
  ].filter(Boolean).join('\n');
  const globalContext = formatDevelopmentContext({
    report: input.developmentReport,
    bible: input.storyBible,
    maxChars: 4500,
  });
  return [scenePlanning, globalContext].filter(Boolean).join('\n\n');
}
