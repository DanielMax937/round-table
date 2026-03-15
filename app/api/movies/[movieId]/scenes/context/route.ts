import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMovie } from '@/lib/db/movies';
import { getSceneOutlinesByMovie } from '@/lib/db/scene-outlines';
import { getCharactersByMovie } from '@/lib/db/characters';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** GET: Get context for next scene to execute (by outline index) */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const { searchParams } = new URL(request.url);
    const outlineIndex = parseInt(searchParams.get('outlineIndex') ?? '0', 10);

    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const outlines = await getSceneOutlinesByMovie(movieId);
    const outline = outlines[outlineIndex];
    if (!outline) {
      return NextResponse.json({ error: 'Outline not found' }, { status: 404 });
    }

    const characterIds = JSON.parse(outline.characterIdsJson || '[]') as string[];
    const characters = await getCharactersByMovie(movieId);
    const sceneChars = characters.filter(c => characterIds.includes(c.id));

    const context = {
      sceneHeading: outline.title,
      contentSummary: outline.contentSummary,
      emotionalGoal: outline.emotionalGoal,
      plotSummary: movie.plotSummary || '',
      characters: sceneChars.map(c => ({
        id: c.id,
        name: c.name,
        backstory: c.backstory.substring(0, 200),
        personalityTraits: c.personalityTraits,
        currentState: c.currentStateJson ? JSON.parse(c.currentStateJson) : null,
      })),
    };

    return NextResponse.json({ context });
  } catch (error) {
    console.error('Error fetching scene context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch context' },
      { status: 500 }
    );
  }
}
