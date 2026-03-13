import { notFound } from 'next/navigation';
import Link from 'next/link';
import SceneView from '@/components/SceneView';
import { getSceneWithDialogue } from '@/lib/db/scenes';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ movieId: string; sceneId: string }>;
}

export default async function ScenePage({ params }: PageProps) {
  const { movieId, sceneId } = await params;
  const scene = await getSceneWithDialogue(sceneId);

  if (!scene || scene.movieId !== movieId) {
    notFound();
  }

  // Parse tool calls in messages
  const roundsWithParsedMessages = scene.roundTable.rounds.map(round => ({
    ...round,
    messages: round.messages.map(msg => {
      const rawToolCalls = (msg as any).toolCalls;
      return {
        ...msg,
        toolCalls: rawToolCalls && typeof rawToolCalls === 'string'
          ? JSON.parse(rawToolCalls)
          : rawToolCalls || undefined,
      };
    }),
  })) as any;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/movies/${movieId}`}
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            &larr; Back to {scene.movie.title}
          </Link>
        </div>

        <SceneView
          movieId={movieId}
          sceneId={sceneId}
          sceneHeading={scene.heading}
          sceneDescription={scene.description}
          roundTableId={scene.roundTableId}
          agents={scene.roundTable.agents}
          rounds={roundsWithParsedMessages}
          status={scene.roundTable.status}
          maxRounds={scene.maxRounds}
          finalizedScript={scene.finalizedScript}
          characters={scene.sceneCharacters.map(sc => ({ name: sc.character.name }))}
        />
      </div>
    </main>
  );
}
