import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';
import { getCharactersByMovie } from '@/lib/db/characters';
import { getSceneOutlinesByMovie } from '@/lib/db/scene-outlines';
import { getScenesByMovie } from '@/lib/db/scenes';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** GET: 获取工作流状态（当前阶段、进度等） */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const outlines = await getSceneOutlinesByMovie(movieId);
    const scenes = await getScenesByMovie(movieId);

    const outlineCount = outlines.length;
    const sceneCount = scenes.length;
    const confirmedSceneCount = scenes.filter(
      s => s.status === 'confirmed' || s.status === 'finalized'
    ).length;
    const isComplete =
      outlineCount > 0 && outlineCount === confirmedSceneCount;

    return NextResponse.json({
      workflowPhase: movie.workflowPhase,
      theme: movie.theme,
      hasStoryProposals: !!movie.storyProposalsJson,
      hasConfirmedStory: !!movie.storyProposalJson,
      characterCount: (await getCharactersByMovie(movieId)).length,
      outlineCount,
      sceneCount,
      confirmedSceneCount,
      isComplete,
      canExport: isComplete,
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow status' },
      { status: 500 }
    );
  }
}
