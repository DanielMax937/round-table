import { Suspense } from 'react';
import Link from 'next/link';

interface Discussion {
    id: string;
    topic: string;
    agentCount: number;
    maxRounds: number;
    status: string;
    createdAt: string;
    roundCount: number;
    agents: { id: string; name: string; order: number }[];
}

async function getDiscussions() {
    const response = await fetch('http://localhost:3002/api/roundtable', {
        cache: 'no-store',
    });
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    return data.roundTables || [];
}

export default async function DiscussionsPage() {
    const discussions: Discussion[] = await getDiscussions();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Discussion Results
                    </h1>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        + New Discussion
                    </Link>
                </div>

                {discussions.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                            No discussions yet. Create your first one!
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {discussions.map((discussion) => (
                            <Link
                                key={discussion.id}
                                href={`/roundtable/${discussion.id}`}
                                className="block"
                            >
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                                {discussion.topic}
                                            </h2>
                                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                                <span>👥 {discussion.agentCount} agents</span>
                                                <span>🔄 {discussion.roundCount} rounds</span>
                                                <span>📅 {new Date(discussion.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {discussion.agents.slice(0, 4).map((agent) => (
                                                    <span
                                                        key={agent.id}
                                                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300"
                                                    >
                                                        {agent.name}
                                                    </span>
                                                ))}
                                                {discussion.agents.length > 4 && (
                                                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500">
                                                        +{discussion.agents.length - 4} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            {discussion.status === 'active' && discussion.roundCount >= discussion.maxRounds ? (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                    Completed ({discussion.roundCount}/{discussion.maxRounds})
                                                </span>
                                            ) : discussion.status === 'active' ? (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                    Active ({discussion.roundCount}/{discussion.maxRounds})
                                                </span>
                                            ) : discussion.status === 'paused' ? (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                    Paused ({discussion.roundCount}/{discussion.maxRounds})
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                                                    {discussion.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
