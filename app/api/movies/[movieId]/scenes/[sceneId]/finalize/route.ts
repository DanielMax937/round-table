import { NextRequest, NextResponse } from 'next/server';
import { getSceneWithDialogue, updateSceneFinalizedScript } from '@/lib/db/scenes';
import { synthesizeScript, ScriptSynthesisInput } from '@/lib/movie/synthesizer';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sceneId } = await params;

    const scene = await getSceneWithDialogue(sceneId);
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    if (!scene.roundTable.rounds.length) {
      return NextResponse.json({ error: 'No dialogue rounds to finalize' }, { status: 400 });
    }

    const input: ScriptSynthesisInput = {
      movieTitle: scene.movie.title,
      sceneHeading: scene.heading,
      sceneDescription: scene.description,
      characters: scene.sceneCharacters.map(sc => ({
        name: sc.character.name,
        backstory: sc.character.backstory,
      })),
      messages: scene.roundTable.rounds.flatMap(round =>
        round.messages.map(msg => ({
          characterName: msg.agent.name,
          content: msg.content,
          roundNumber: round.roundNumber,
        }))
      ),
    };

    const { fullContent } = await synthesizeScript(input);
    await updateSceneFinalizedScript(sceneId, fullContent);

    return NextResponse.json({ fullContent });
  } catch (error) {
    console.error('Error finalizing scene:', error);
    return NextResponse.json(
      { error: 'Failed to finalize', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
