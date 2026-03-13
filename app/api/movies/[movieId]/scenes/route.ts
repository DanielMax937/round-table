import { NextRequest, NextResponse } from 'next/server';
import { createScene, getScenesByMovie } from '@/lib/db/scenes';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const { heading, description, characterIds, maxRounds } = await request.json();

    if (!heading?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Heading and description are required' }, { status: 400 });
    }

    if (!characterIds || !Array.isArray(characterIds) || characterIds.length < 2) {
      return NextResponse.json({ error: 'At least 2 characters are required' }, { status: 400 });
    }

    const scene = await createScene(movieId, heading, description, characterIds, maxRounds || 10);
    return NextResponse.json({ scene }, { status: 201 });
  } catch (error) {
    console.error('Error creating scene:', error);
    return NextResponse.json(
      { error: 'Failed to create scene', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const scenes = await getScenesByMovie(movieId);
    return NextResponse.json({ scenes });
  } catch (error) {
    console.error('Error fetching scenes:', error);
    return NextResponse.json({ error: 'Failed to fetch scenes' }, { status: 500 });
  }
}
