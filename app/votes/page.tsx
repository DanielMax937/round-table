'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface VoteJob {
    jobId: string;
    status: string;
    question: string;
    agentCount: number;
    createdAt: string;
    completedAt?: string;
    currentRound?: number;
    currentPhase?: string;
}

export default function VotesPage() {
    const [votes, setVotes] = useState<VoteJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchVotes = async () => {
            try {
                const response = await fetch('/api/moe-vote');
                if (!response.ok) {
                    throw new Error('Failed to fetch votes');
                }
                const data = await response.json();
                setVotes(data.jobs || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchVotes();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading vote jobs...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                        <h2 className="text-xl font-bold text-red-900 dark:text-red-300 mb-2">Error</h2>
                        <p className="text-red-700 dark:text-red-400">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        MoE Vote Results
                    </h1>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {votes.length} total vote{votes.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {votes.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                        <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                            No vote jobs yet.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                            Create a vote job using the API:
                        </p>
                        <pre className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded text-left text-xs overflow-x-auto">
                            {`curl -X POST http://localhost:3002/api/moe-vote \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "人工智能是否应该有道德规范？",
    "agentCount": 3
  }'`}
                        </pre>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {votes.map((vote) => (
                            <Link
                                key={vote.jobId}
                                href={`/moe-vote/${vote.jobId}`}
                                className="block"
                            >
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                                {vote.question}
                                            </h2>
                                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                                <span>👥 {vote.agentCount} agents</span>
                                                <span>📅 {new Date(vote.createdAt).toLocaleString()}</span>
                                                {vote.completedAt && (
                                                    <span>✓ {new Date(vote.completedAt).toLocaleString()}</span>
                                                )}
                                            </div>
                                            {vote.currentRound && vote.currentPhase && (
                                                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                    Round {vote.currentRound} • {vote.currentPhase}
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <span
                                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${vote.status === 'completed'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : vote.status === 'failed'
                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                            : vote.status === 'running'
                                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-400'
                                                    }`}
                                            >
                                                {vote.status.toUpperCase()}
                                            </span>
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
