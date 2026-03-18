import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 600; // 10 min for scene re-execution
import { executeSceneWithAgents } from '@/lib/movie/scene-executor';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

/** POST: Re-execute scene dialogue (for scenes that exist but have no finalizedScript) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, sceneId } = await params;

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, movieId },
      include: { movie: true },
    });

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const result = await executeSceneWithAgents(sceneId, {
      header: `🎬 场景重执行: ${scene.heading}\n\n（角色逐句生成中）`,
    });

    return NextResponse.json({
      sceneId: result.sceneId,
      fullScript: result.fullScript,
      messageCount: result.messageCount,
    });
  } catch (error) {
    console.error('Error re-executing scene:', error);
    return NextResponse.json(
      {
        error: 'Failed to re-execute scene',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
