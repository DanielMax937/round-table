import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateScene } from '@/lib/db/scenes';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

/** POST: 用户确认场景（仅标记为已确认，不执行记忆结算） */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, sceneId } = await params;
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
    });
    if (!scene || scene.movieId !== movieId) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }
    await updateScene(sceneId, { status: 'confirmed' });
    return NextResponse.json({ success: true, status: 'confirmed' });
  } catch (error) {
    console.error('Error confirming scene:', error);
    return NextResponse.json(
      { error: 'Failed to confirm scene' },
      { status: 500 }
    );
  }
}
