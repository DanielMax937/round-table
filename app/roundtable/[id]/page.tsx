import { notFound } from 'next/navigation';
import Link from 'next/link';
import DiscussionView from '@/components/DiscussionView';
import { getRoundTableWithDetails } from '@/lib/db/roundtable';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DiscussionPage({ params }: PageProps) {
  const { id } = await params;

  const roundTable = await getRoundTableWithDetails(id);

  if (!roundTable) {
    notFound();
  }

  // Parse tool calls in messages (toolCalls is stored as JSON string in DB)
  const roundsWithParsedMessages = roundTable.rounds.map((round) => ({
    ...round,
    messages: round.messages.map((msg) => {
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
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/discussions"
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            ← Back to History
          </Link>
        </div>

        <DiscussionView
          roundTableId={roundTable.id}
          topic={roundTable.topic}
          agents={roundTable.agents}
          rounds={roundsWithParsedMessages}
          status={roundTable.status}
          maxRounds={roundTable.maxRounds}
        />
      </div>
    </main>
  );
}
