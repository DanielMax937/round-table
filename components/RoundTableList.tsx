'use client';

import { useRouter } from 'next/navigation';

interface Agent {
  id: string;
  name: string;
  order: number;
}

interface RoundTable {
  id: string;
  topic: string;
  agentCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  roundCount: number;
  agents: Agent[];
}

interface RoundTableListProps {
  roundTables: RoundTable[];
}

export default function RoundTableList({ roundTables }: RoundTableListProps) {
  const router = useRouter();

  if (roundTables.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">💬</div>
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          No round tables yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Create your first round table to get started
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
        >
          Create Round Table
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const deleteRoundTable = async (id: string) => {
    if (!confirm('Are you sure you want to delete this round table?')) return;

    try {
      const response = await fetch(`/api/roundtable/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to delete round table:', err);
    }
  };

  return (
    <div className="space-y-4">
      {roundTables.map((rt) => (
        <div
          key={rt.id}
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {rt.topic}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(rt.status)}`}>
                  {rt.status}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <span>👥 {rt.agentCount} agents</span>
                <span>🔄 {rt.roundCount} round{rt.roundCount !== 1 ? 's' : ''}</span>
                <span>📅 {new Date(rt.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {rt.agents.slice(0, 4).map((agent) => (
                  <span
                    key={agent.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300"
                  >
                    {agent.name}
                  </span>
                ))}
                {rt.agents.length > 4 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    +{rt.agents.length - 4} more
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 ml-4">
              <button
                onClick={() => router.push(`/roundtable/${rt.id}`)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
              >
                {rt.status === 'active' ? 'Continue' : 'View'}
              </button>

              {rt.status !== 'archived' && (
                <button
                  onClick={() => deleteRoundTable(rt.id)}
                  className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 text-sm font-medium"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
