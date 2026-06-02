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
      return NextResponse.json({ error: '场景标题和描述均为必填项' }, { status: 400 });
    }

    if (!characterIds || !Array.isArray(characterIds) || characterIds.length < 2) {
      return NextResponse.json({ error: '至少需要 2 个角色' }, { status: 400 });
    }

    const scene = await createScene(movieId, heading, description, characterIds, maxRounds || 10);
    return NextResponse.json({ scene }, { status: 201 });
  } catch (error) {
    console.error('Error creating scene:', error);
    return NextResponse.json(
      { error: '创建场景失败', details: error instanceof Error ? error.message : '未知错误' },
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
    return NextResponse.json({ error: '获取场景失败' }, { status: 500 });
  }
}
