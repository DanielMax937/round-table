import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** GET: 获取已确认的故事提案 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: '电影项目不存在' }, { status: 404 });
    }
    const story = movie.storyProposalJson
      ? (JSON.parse(movie.storyProposalJson) as Record<string, string>)
      : null;
    return NextResponse.json({ story });
  } catch (error) {
    console.error('Error fetching story:', error);
    return NextResponse.json(
      { error: '获取故事失败' },
      { status: 500 }
    );
  }
}
