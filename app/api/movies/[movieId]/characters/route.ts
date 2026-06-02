import { NextRequest, NextResponse } from 'next/server';
import { createCharacter, getCharactersByMovie } from '@/lib/db/characters';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json();
    const { name, backstory, personalityTraits } = body;

    if (!name?.trim() || !backstory?.trim() || !personalityTraits?.trim()) {
      return NextResponse.json(
        { error: '姓名、背景故事和性格特征均为必填项' },
        { status: 400 }
      );
    }

    const character = await createCharacter(movieId, {
      name,
      backstory,
      personalityTraits,
      surfaceGoal: body.surfaceGoal,
      deepMotivation: body.deepMotivation,
      fatalFlaw: body.fatalFlaw,
      signatureLanguageStyle: body.signatureLanguageStyle,
    });
    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    console.error('Error creating character:', error);
    return NextResponse.json({ error: '创建角色失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const characters = await getCharactersByMovie(movieId);
    return NextResponse.json({ characters });
  } catch (error) {
    console.error('Error fetching characters:', error);
    return NextResponse.json({ error: '获取角色失败' }, { status: 500 });
  }
}
