import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';
import { getScenesByMovie } from '@/lib/db/scenes';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** GET: Export full screenplay as text */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;

    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const scenes = await getScenesByMovie(movieId);
    const confirmedScenes = scenes.filter(s => s.status === 'confirmed' || s.status === 'finalized');
    const scripts = confirmedScenes
      .sort((a, b) => a.sceneNumber - b.sceneNumber)
      .map(s => s.finalizedScript)
      .filter(Boolean) as string[];

    const title = movie.title;
    const header = `${title.toUpperCase()}\n\nWritten by AI Screenplay Assistant\n\n`;
    const body = scripts.join('\n\n');
    const fullScript = header + body;

    return new Response(fullScript, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}.txt"`,
      },
    });
  } catch (error) {
    console.error('Error exporting script:', error);
    return NextResponse.json(
      { error: 'Failed to export', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
