import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';
import { getCharactersByMovie } from '@/lib/db/characters';
import { createCharacter } from '@/lib/db/characters';
import { generateCharactersFromStory } from '@/lib/movie/character-generator';
import type { StoryProposal } from '@/lib/movie/types';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** POST: Generate characters from confirmed story, create in DB */
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
        { error: 'No story proposal confirmed. Confirm a story first.' },
        { status: 400 }
      );
    }

    const proposal = JSON.parse(proposalJson) as StoryProposal;
    const profiles = await generateCharactersFromStory(proposal);

    const existing = await getCharactersByMovie(movieId);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Characters already exist. Delete them first to regenerate.' },
        { status: 400 }
      );
    }

    const characters = await Promise.all(
      profiles.map(p =>
        createCharacter(movieId, {
          name: p.name,
          backstory: p.backstory,
          personalityTraits: p.personalityTraits,
          surfaceGoal: p.surfaceGoal,
          deepMotivation: p.deepMotivation,
          fatalFlaw: p.fatalFlaw,
          signatureLanguageStyle: p.signatureLanguageStyle,
        })
      )
    );

    const { sendTextToTelegram } = await import('@/lib/telegram');
    const charList = characters
      .map((c: any) => `• ${c.name}: ${(c.personalityTraits || '').slice(0, 50)}${(c.personalityTraits || '').length > 50 ? '...' : ''}`)
      .join('\n');
    sendTextToTelegram(
      `👥 角色已生成 (${characters.length} 个)\n\n${charList}\n\n请审阅并确认\n→ POST /api/movies/${movieId}/confirm-characters`
    ).catch(() => {});

    return NextResponse.json({ characters }, { status: 201 });
  } catch (error) {
    console.error('Error generating characters:', error);
    return NextResponse.json(
      { error: 'Failed to generate characters', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
