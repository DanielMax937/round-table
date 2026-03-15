import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMovie, updateMovie } from '@/lib/db/movies';
import { updateScene } from '@/lib/db/scenes';
import { updateCharacter } from '@/lib/db/characters';
import { settleMemory } from '@/lib/movie/memory-settlement';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

/** POST: Settle memory after scene confirmed, update plot summary and character states */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, sceneId } = await params;

    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        movie: true,
        sceneCharacters: {
          orderBy: { order: 'asc' },
          include: { character: true },
        },
      },
    });

    if (!scene || scene.movieId !== movieId) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const script = scene.finalizedScript;
    if (!script?.trim()) {
      return NextResponse.json(
        { error: 'Scene has no script. Finalize the scene first.' },
        { status: 400 }
      );
    }

    const chars = scene.sceneCharacters.map(sc => sc.character);
    const result = await settleMemory(
      script,
      {
        sceneHeading: scene.heading,
        contentSummary: scene.contentSummary || scene.description,
        emotionalGoal: scene.emotionalGoal || '',
        characters: chars.map(c => ({
          id: c.id,
          name: c.name,
          currentStateJson: c.currentStateJson,
        })),
      },
      scene.movie.plotSummary || ''
    );

    const newPlotSummary = [scene.movie.plotSummary, result.plotSummaryAddition]
      .filter(Boolean)
      .join('\n\n');

    await updateMovie(movieId, { plotSummary: newPlotSummary });
    await updateScene(sceneId, {
      settlementSummary: result.plotSummaryAddition,
      status: 'confirmed',
    });

    for (const [charName, state] of Object.entries(result.characterStateUpdates)) {
      const char = chars.find(c => c.name === charName);
      if (char) {
        await updateCharacter(char.id, {
          currentStateJson: JSON.stringify(state),
        });
      }
    }

    const { sendTextToTelegram } = await import('@/lib/telegram');
    sendTextToTelegram(
      `✅ 场景已确认，记忆已结算\n\n${scene.heading}\n\n剧情摘要: ${result.plotSummaryAddition?.slice(0, 300) || '-'}...\n\n角色状态已更新。进入下一场: POST /api/movies/${movieId}/scenes/execute { outlineIndex: N }`
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      plotSummaryAddition: result.plotSummaryAddition,
      characterStatesUpdated: Object.keys(result.characterStateUpdates).length,
    });
  } catch (error) {
    console.error('Error settling memory:', error);
    return NextResponse.json(
      { error: 'Failed to settle', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
