import { NextRequest } from 'next/server';
import { getSceneWithDialogue, updateSceneFinalizedScript } from '@/lib/db/scenes';
import { synthesizeScript, ScriptSynthesisInput } from '@/lib/movie/synthesizer';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { sceneId } = await params;

  const scene = await getSceneWithDialogue(sceneId);
  if (!scene) {
    return new Response(JSON.stringify({ error: 'Scene not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!scene.roundTable.rounds.length) {
    return new Response(JSON.stringify({ error: 'No dialogue rounds to finalize' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullScript = '';

        for await (const event of synthesizeScript(input)) {
          const sseData = JSON.stringify(event.data);
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${sseData}\n\n`));

          if (event.type === 'finalize-complete') {
            fullScript = event.data.fullContent;
          }
        }

        // Save finalized script to database
        if (fullScript) {
          await updateSceneFinalizedScript(sceneId, fullScript);
        }

        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
