import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMovie } from '@/lib/db/movies';
import { getSceneOutlinesByMovie } from '@/lib/db/scene-outlines';
import { createSceneFromOutline } from '@/lib/db/scenes';
import { executeSceneWithAgents } from '@/lib/movie/scene-executor';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** POST: Execute scene from outline (by outline index 0-based). Uses agents for turn-by-turn dialogue. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const { outlineIndex } = await request.json().catch(() => ({}));
    const index = typeof outlineIndex === 'number' ? outlineIndex : 0;

    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const outlines = await getSceneOutlinesByMovie(movieId);
    const outline = outlines[index];
    if (!outline) {
      return NextResponse.json({ error: 'Outline not found' }, { status: 404 });
    }

    const characterIds = JSON.parse(outline.characterIdsJson || '[]') as string[];
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds }, movieId },
    });

    if (characters.length === 0) {
      return NextResponse.json(
        { error: 'No valid characters for this scene' },
        { status: 400 }
      );
    }

    const existingScene = await prisma.scene.findFirst({
      where: { sceneOutlineId: outline.id },
    });
    if (existingScene) {
      return NextResponse.json(
        { error: 'Scene already created for this outline', sceneId: existingScene.id },
        { status: 400 }
      );
    }

    const scene = await createSceneFromOutline(movieId, outline.id, {
      title: outline.title,
      contentSummary: outline.contentSummary,
      emotionalGoal: outline.emotionalGoal,
      characterIds: characters.map(c => c.id),
    });

    const result = await executeSceneWithAgents(scene.id, {
      header: `🎬 场景 ${index + 1} 已生成: ${outline.title}\n\n（角色逐句生成中，请留意 Telegram）\n\n请审阅。可反馈重写或确认进入下一场。`,
    });

    return NextResponse.json({
      sceneId: result.sceneId,
      fullScript: result.fullScript,
      messageCount: result.messageCount,
    });
  } catch (error) {
    console.error('Error executing scene:', error);
    return NextResponse.json(
      { error: 'Failed to execute scene', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
