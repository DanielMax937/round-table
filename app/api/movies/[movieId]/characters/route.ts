import { NextRequest, NextResponse } from 'next/server';
import { createCharacter, getCharactersByMovie } from '@/lib/db/characters';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const { name, backstory, personalityTraits } = await request.json();

    if (!name?.trim() || !backstory?.trim() || !personalityTraits?.trim()) {
      return NextResponse.json(
        { error: 'Name, backstory, and personalityTraits are all required' },
        { status: 400 }
      );
    }

    const character = await createCharacter(movieId, name, backstory, personalityTraits);
    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    console.error('Error creating character:', error);
    return NextResponse.json({ error: 'Failed to create character' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const characters = await getCharactersByMovie(movieId);
    return NextResponse.json({ characters });
  } catch (error) {
    console.error('Error fetching characters:', error);
    return NextResponse.json({ error: 'Failed to fetch characters' }, { status: 500 });
  }
}
