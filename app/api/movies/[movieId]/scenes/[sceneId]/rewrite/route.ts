import { NextRequest, NextResponse } from 'next/server';
import { getScene } from '@/lib/db/scenes';
import { updateScene } from '@/lib/db/scenes';
import { getMovie } from '@/lib/db/movies';
import { rewriteSceneWithFeedback } from '@/lib/movie/rewrite';
import { prisma } from '@/lib/prisma';
import { parseScreenplayDialogue } from '@/lib/movie/script-parser';
import {
  repairSceneScript,
  reviewSceneScript,
  type SceneScriptReviewInput,
  type SceneScriptReviewResult,
} from '@/lib/movie/script-reviewer';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

/** POST: Rewrite scene based on user feedback */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sceneId } = await params;
    const { feedback } = await request.json();

    if (!feedback?.trim()) {
      return NextResponse.json({ error: '反馈内容为必填项' }, { status: 400 });
    }

    const scene = await getScene(sceneId);
    if (!scene) {
      return NextResponse.json({ error: '场景不存在' }, { status: 404 });
    }

    const movie = scene.movieId ? await getMovie(scene.movieId) : null;
    const movieTitle = movie?.title ?? 'Untitled';

    const currentScript = scene.finalizedScript || '';
    if (!currentScript) {
      return NextResponse.json({ error: '当前场景没有可重写的剧本' }, { status: 400 });
    }

    const reviewResult = await rewriteAndReviewScene({
      currentScript,
      feedback,
      movieTitle,
      scene,
    });

    await updateScene(sceneId, { finalizedScript: reviewResult.script });
    await recordRewriteQualityReview({
      movieId: scene.movieId,
      sceneId,
      sceneNumber: scene.sceneNumber,
      heading: scene.heading,
      review: reviewResult.review,
      attempts: reviewResult.attempts,
      bestEffort: reviewResult.bestEffort,
    });

    const { sendScriptToTelegramSeparateDialogues } = await import('@/lib/telegram');
    sendScriptToTelegramSeparateDialogues(reviewResult.script, {
      header: `✏️ 已根据反馈重写\n\n反馈: ${feedback}\n\n质检: ${reviewResult.bestEffort ? '未完全通过，已保存 best effort' : '已通过'}\n\n---\n\n请确认或继续反馈。`,
    }).catch(() => {});

    return NextResponse.json({
      script: reviewResult.script,
      review: reviewResult.review,
      attempts: reviewResult.attempts,
      bestEffort: reviewResult.bestEffort,
    });
  } catch (error) {
    console.error('Error rewriting scene:', error);
    return NextResponse.json(
      { error: '重写场景失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

async function rewriteAndReviewScene(input: {
  currentScript: string;
  feedback: string;
  movieTitle: string;
  scene: NonNullable<Awaited<ReturnType<typeof getScene>>>;
}) {
  const maxAttempts = Math.max(1, Number(process.env.SCENE_REWRITE_REVIEW_MAX_ATTEMPTS || 3));
  let script = await rewriteSceneWithFeedback(input.currentScript, input.feedback, {
    movieTitle: input.movieTitle,
    sceneHeading: input.scene.heading,
  });
  let review: SceneScriptReviewResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const reviewInput = buildRewriteReviewInput(input.scene, input.movieTitle, script, attempt);
    review = await reviewSceneScript(reviewInput);
    if (review.passed) {
      return { script, review, attempts: attempt, bestEffort: false };
    }
    if (attempt < maxAttempts) {
      script = await repairSceneScript(reviewInput, review);
    }
  }

  if (!review) {
    throw new Error('重写质检没有返回结果');
  }

  return { script, review, attempts: maxAttempts, bestEffort: true };
}

function buildRewriteReviewInput(
  scene: NonNullable<Awaited<ReturnType<typeof getScene>>>,
  movieTitle: string,
  script: string,
  attempt: number
): SceneScriptReviewInput {
  return {
    movieTitle,
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
    rawDialogue: extractDialogue(script),
    script,
    attempt,
  };
}

function extractDialogue(script: string): Array<{ roundNumber: number; characterName: string; content: string }> {
  return parseScreenplayDialogue(script).dialogues.map((dialogue, index) => ({
    roundNumber: index + 1,
    characterName: dialogue.character,
    content: dialogue.content,
  }));
}

async function recordRewriteQualityReview(input: {
  movieId: string;
  sceneId: string;
  sceneNumber: number;
  heading: string;
  review: SceneScriptReviewResult;
  attempts: number;
  bestEffort: boolean;
}) {
  const issues = input.bestEffort
    ? [...input.review.issues, '手动重写自动质检 3 轮后仍未完全通过，已保存当前 best effort 版本。']
    : input.review.issues;

  await prisma.qualityReviewJob.create({
    data: {
      movieId: input.movieId,
      targetType: 'script',
      targetId: input.sceneId,
      sceneId: input.sceneId,
      title: `重写后剧本质检：场景 ${input.sceneNumber} ${input.heading}`,
      status: 'completed',
      passed: input.review.passed && !input.bestEffort,
      score: input.review.score,
      aiFeel: input.review.aiFeel,
      industryLevel: industryLevelFromScore(input.review.score, input.review.passed && !input.bestEffort),
      summary: input.bestEffort ? `Best effort：${input.review.summary}` : input.review.summary,
      issuesJson: JSON.stringify(issues),
      repairInstructions: input.review.rewriteInstructions,
      resultJson: JSON.stringify({
        source: 'scene_rewrite_auto_review',
        attempts: input.attempts,
        bestEffort: input.bestEffort,
        review: input.review,
      }),
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
}

function industryLevelFromScore(score: number, passed: boolean): string {
  if (passed && score >= 9) return 'strong_professional';
  if (passed && score >= 8) return 'ordinary_professional';
  if (score >= 5) return 'rough_internal';
  return 'not_usable';
}
