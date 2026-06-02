import { NextRequest, NextResponse } from 'next/server';
import { getMovieWithDetails, updateMovie, deleteMovie } from '@/lib/db/movies';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovieWithDetails(movieId);

    if (!movie) {
      return NextResponse.json({ error: '电影项目不存在' }, { status: 404 });
    }

    return NextResponse.json({ movie });
  } catch (error) {
    console.error('Error fetching movie:', error);
    return NextResponse.json({ error: '获取电影项目失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json();
    const movie = await updateMovie(movieId, body);
    return NextResponse.json({ movie });
  } catch (error) {
    console.error('Error updating movie:', error);
    return NextResponse.json({ error: '更新电影项目失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    await deleteMovie(movieId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting movie:', error);
    return NextResponse.json({ error: '删除电影项目失败' }, { status: 500 });
  }
}
