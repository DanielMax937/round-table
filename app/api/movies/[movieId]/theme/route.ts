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
      return NextResponse.json({ error: '电影项目不存在' }, { status: 404 });
    }
    return NextResponse.json({ theme: movie.theme ?? '' });
  } catch (error) {
    console.error('Error fetching theme:', error);
    return NextResponse.json(
      { error: '获取主题失败' },
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
      return NextResponse.json({ error: '电影项目不存在' }, { status: 404 });
    }
    const { theme } = await request.json();
    if (typeof theme !== 'string') {
      return NextResponse.json({ error: '主题必须是字符串' }, { status: 400 });
    }
    await updateMovie(movieId, {
      theme: theme.trim() || undefined,
      workflowPhase: theme.trim() ? 'proposals' : movie.workflowPhase,
    });
    const updated = await getMovie(movieId);
    return NextResponse.json({ theme: updated?.theme ?? '' });
  } catch (error) {
    console.error('Error updating theme:', error);
    return NextResponse.json(
      { error: '更新主题失败' },
      { status: 500 }
    );
  }
}
