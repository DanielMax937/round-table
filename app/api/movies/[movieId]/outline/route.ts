import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';
import { getCharactersByMovie } from '@/lib/db/characters';
import { createSceneOutlines, getSceneOutlinesByMovie } from '@/lib/db/scene-outlines';
import { generateSceneOutline } from '@/lib/movie/outline-generator';
import type { StoryProposal } from '@/lib/movie/types';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** POST: Generate scene outline from story + characters */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const proposalJson = movie.storyProposalJson;
    if (!proposalJson) {
      return NextResponse.json(
        { error: 'No story proposal confirmed.' },
        { status: 400 }
      );
    }

    const characters = await getCharactersByMovie(movieId);
    if (characters.length === 0) {
      return NextResponse.json(
        { error: 'No characters. Generate characters first.' },
        { status: 400 }
      );
    }

    const proposal = JSON.parse(proposalJson) as StoryProposal;
    const items = await generateSceneOutline(
      proposal,
      characters.map(c => ({ id: c.id, name: c.name }))
    );

    await createSceneOutlines(movieId, items);
    const outlines = await getSceneOutlinesByMovie(movieId);

    const { sendTextToTelegram } = await import('@/lib/telegram');
    const outlineList = outlines.map((o: any) => `${o.sortOrder}. ${o.title}`).join('\n');
    sendTextToTelegram(
      `📋 场景大纲已生成 (${outlines.length} 场)\n\n${outlineList}\n\n请审阅并确认\n→ POST /api/movies/${movieId}/confirm-outline`
    ).catch(() => {});

    return NextResponse.json({ outlines });
  } catch (error) {
    console.error('Error generating outline:', error);
    return NextResponse.json(
      { error: 'Failed to generate outline', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/** GET: List scene outlines */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const outlines = await getSceneOutlinesByMovie(movieId);
    return NextResponse.json({ outlines });
  } catch (error) {
    console.error('Error fetching outline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outline' },
      { status: 500 }
    );
  }
}
