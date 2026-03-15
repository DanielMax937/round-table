import { NextRequest, NextResponse } from 'next/server';
import { createMovie, getAllMovies } from '@/lib/db/movies';

export async function POST(request: NextRequest) {
  try {
    const { title, description, theme } = await request.json();

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const movie = await createMovie({ title, description, theme });
    const { sendTextToTelegram } = await import('@/lib/telegram');
    sendTextToTelegram(
      `🎬 主题已创建\n\n标题: ${movie.title}\nID: ${movie.id}\n\n请审阅主题，同意则生成故事提案\n→ POST /api/movies/${movie.id}/story-proposals`
    ).catch(() => {});
    return NextResponse.json({ movie }, { status: 201 });
  } catch (error) {
    console.error('Error creating movie:', error);
    return NextResponse.json(
      { error: 'Failed to create movie', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const movies = await getAllMovies();
    return NextResponse.json({ movies });
  } catch (error) {
    console.error('Error fetching movies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch movies' },
      { status: 500 }
    );
  }
}
