import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';
import { getScenesByMovie } from '@/lib/db/scenes';
import {
  createNovelJob,
  getNovelJob,
  updateNovelJob,
} from '@/lib/db/novel-jobs';
import { convertMovieToNovel } from '@/lib/movie/novel-converter';
import { reviewNovelChapter, repairNovelChapter } from '@/lib/movie/novel-reviewer';

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
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const scenes = await getScenesByMovie(movieId);
    const confirmedScenes = scenes.filter(
      s => (s.status === 'confirmed' || s.status === 'finalized') && s.finalizedScript
    );

    if (confirmedScenes.length === 0) {
      return NextResponse.json(
        { error: 'No finalized scenes found. Complete scene execution first.' },
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
      { error: 'Failed to start conversion', details: error instanceof Error ? error.message : 'Unknown' },
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
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.movieId !== movieId) {
      return NextResponse.json({ error: 'Job does not belong to this movie' }, { status: 400 });
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
      { error: 'Failed to poll job', details: error instanceof Error ? error.message : 'Unknown' },
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
            sceneCharacters: {
              include: { character: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!movie) throw new Error('Movie not found');
    if (movie.scenes.length === 0) throw new Error('No finalized scenes found');

    const totalChapters = movie.scenes.length;
    await updateNovelJob(jobId, { totalChapters });

    const chapters: Array<{ chapterNumber: number; title: string; content: string }> = [];

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
      error: error instanceof Error ? error.message : 'Unknown error',
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
    previousChapters: Array<{ chapterNumber: number; title: string; content: string }>;
    chapterNumber: number;
  },
  maxAttempts: number = 3
) {
  const { convertScriptToNovel } = await import('@/lib/movie/novel-converter');
  const { reviewSubversive } = await import('@/lib/movie/subversive-reviewer');

  let lastResult: { chapterNumber: number; title: string; content: string } | null = null;
  let lastReview: { passed: boolean; score: number; summary: string; issues: string[]; rewriteInstructions: string } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Convert
    const chapter = await convertScriptToNovel(input);
    lastResult = chapter;

    // Review 1: 基础质量审查
    const reviewInput = {
      movieTitle: input.movieTitle,
      chapterNumber: input.chapterNumber,
      chapterTitle: chapter.title,
      chapterContent: chapter.content,
      characters: input.characters,
    };

    const review = await reviewNovelChapter(reviewInput);
    lastReview = review;

    // Review 2: 颠覆审查（只有基础审查通过才执行）
    let subversivePassed = false;
    let subversiveSummary = '';
    let subversiveIssues: string[] = [];
    let subversiveSuggestions: string[] = [];

    if (review.passed) {
      const subversiveReview = await reviewSubversive({
        movieTitle: input.movieTitle,
        sceneHeading: `第${input.chapterNumber}章 ${chapter.title}`,
        sceneDescription: input.sceneDescription,
        script: chapter.content,
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

      return chapter;
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
        rewriteInstructions: review.rewriteInstructions + (subversivePassed ? '' : `\n\n颠覆审查反馈：${subversiveSummary}\n${subversiveSuggestions.join('；')}`),
      };
      const repairedContent = await repairNovelChapter(reviewInput, enhancedReview);
      // Use repaired content as the chapter for next review
      lastResult = {
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        content: repairedContent,
      };
    }
  }

  // Return last result even if review failed
  console.log(`[Novel] Chapter ${input.chapterNumber} using last result after ${maxAttempts} attempts`);
  return lastResult!;
}

function assembleNovel(title: string, chapters: Array<{ chapterNumber: number; title: string; content: string }>): string {
  let novel = `${title}\n\n`;

  for (const chapter of chapters) {
    novel += `${chapter.title}\n\n`;
    novel += `${chapter.content}\n\n\n`;
  }

  return novel.trim();
}
