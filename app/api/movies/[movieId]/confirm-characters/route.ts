import { NextRequest, NextResponse } from 'next/server';
import { getMovie, updateMovie } from '@/lib/db/movies';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** POST: 确认角色，进入大纲阶段 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }
    await updateMovie(movieId, { workflowPhase: 'outline' });

    const { sendTextToTelegram } = await import('@/lib/telegram');
    sendTextToTelegram(
      `✅ 角色已确认\n\n下一步: 生成场景大纲\n→ POST /api/movies/${movieId}/outline`
    ).catch(() => {});

    return NextResponse.json({ success: true, workflowPhase: 'outline' });
  } catch (error) {
    console.error('Error confirming characters:', error);
    return NextResponse.json(
      { error: 'Failed to confirm characters' },
      { status: 500 }
    );
  }
}
