import { NextRequest, NextResponse } from 'next/server';
import { getMovie, updateMovie } from '@/lib/db/movies';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** POST: Confirm outline, move to scene execution phase */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    await updateMovie(movieId, { workflowPhase: 'scene_execution' });

    const { sendTextToTelegram } = await import('@/lib/telegram');
    sendTextToTelegram(
      `✅ 大纲已确认\n\n下一步: 按顺序执行场景生成\n→ POST /api/movies/${movieId}/scenes/execute { outlineIndex: 0 }`
    ).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error confirming outline:', error);
    return NextResponse.json(
      { error: 'Failed to confirm outline' },
      { status: 500 }
    );
  }
}
