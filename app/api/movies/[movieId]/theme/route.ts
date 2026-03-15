import { NextRequest, NextResponse } from 'next/server';
import { getMovie, updateMovie } from '@/lib/db/movies';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** GET: 获取当前主题 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }
    return NextResponse.json({ theme: movie.theme ?? '' });
  } catch (error) {
    console.error('Error fetching theme:', error);
    return NextResponse.json(
      { error: 'Failed to fetch theme' },
      { status: 500 }
    );
  }
}

/** PUT: 设置/更新主题 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }
    const { theme } = await request.json();
    if (typeof theme !== 'string') {
      return NextResponse.json({ error: 'theme must be a string' }, { status: 400 });
    }
    await updateMovie(movieId, {
      theme: theme.trim() || null,
      workflowPhase: theme.trim() ? 'proposals' : movie.workflowPhase,
    });
    const updated = await getMovie(movieId);
    return NextResponse.json({ theme: updated?.theme ?? '' });
  } catch (error) {
    console.error('Error updating theme:', error);
    return NextResponse.json(
      { error: 'Failed to update theme' },
      { status: 500 }
    );
  }
}
