import Link from 'next/link';
import RoundTableList from '@/components/RoundTableList';
import { getAllRoundTables } from '@/lib/db/roundtable';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const rawRoundTables = await getAllRoundTables();

  // Transform to match component interface
  const roundTables = rawRoundTables.map(rt => ({
    id: rt.id,
    topic: rt.topic,
    agentCount: rt.agentCount,
    status: rt.status,
    createdAt: rt.createdAt.toISOString(),
    updatedAt: rt.updatedAt.toISOString(),
    roundCount: rt._count?.rounds ?? 0,
    agents: rt.agents.map(a => ({
      id: a.id,
      name: a.name,
      order: a.order,
    })),
  }));

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Discussion History</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              All your round table discussions
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
          >
            New Discussion
          </Link>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {roundTables.length} discussion{roundTables.length !== 1 ? 's' : ''}
          </p>
        </div>

        <RoundTableList roundTables={roundTables} />
      </div>
    </main>
  );
}
