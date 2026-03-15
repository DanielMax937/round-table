import { NextRequest, NextResponse } from 'next/server';
import { getScene } from '@/lib/db/scenes';
import { updateScene } from '@/lib/db/scenes';
import { getMovie } from '@/lib/db/movies';
import { rewriteSceneWithFeedback } from '@/lib/movie/rewrite';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

/** POST: Rewrite scene based on user feedback */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sceneId } = await params;
    const { feedback } = await request.json();

    if (!feedback?.trim()) {
      return NextResponse.json({ error: 'Feedback is required' }, { status: 400 });
    }

    const scene = await getScene(sceneId);
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const movie = scene.movieId ? await getMovie(scene.movieId) : null;
    const movieTitle = movie?.title ?? 'Untitled';

    const currentScript = scene.finalizedScript || '';
    if (!currentScript) {
      return NextResponse.json({ error: 'Scene has no script to rewrite' }, { status: 400 });
    }

    const revised = await rewriteSceneWithFeedback(currentScript, feedback, {
      movieTitle,
      sceneHeading: scene.heading,
    });

    await updateScene(sceneId, { finalizedScript: revised });

    const { sendScriptToTelegramSeparateDialogues } = await import('@/lib/telegram');
    sendScriptToTelegramSeparateDialogues(revised, {
      header: `✏️ 已根据反馈重写\n\n反馈: ${feedback}\n\n---\n\n请确认或继续反馈。`,
    }).catch(() => {});

    return NextResponse.json({ script: revised });
  } catch (error) {
    console.error('Error rewriting scene:', error);
    return NextResponse.json(
      { error: 'Failed to rewrite', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
