'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface AgentVote {
    agentId: string;
    voterId: string;
    voterName: string;
    score: number;
    justification: string;
}

interface AgentScore {
    agentId: string;
    agentName: string;
    averageScore: number;
    votes: AgentVote[];
}

interface VoteResult {
    finalDecision: 'yes' | 'no';
    decisionThought?: string;
    confidence: number;
    winner: {
        agentId: string;
        agentName: string;
        averageScore: number;
    };
    scores: {
        [agentId: string]: AgentScore;
    };
    discussionSummary: {
        roundCount: number;
        totalMessages: number;
        toolCallsUsed: number;
    };
}

interface MoeVoteJob {
    jobId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    question: string;
    agentCount?: number;
    progress?: {
        currentRound: number;
        totalRounds: number;
        phase: string;
    };
    result?: VoteResult;
    error?: string;
    createdAt: string;
    completedAt?: string;
}

export default function MoeVotePage() {
    const params = useParams();
    const router = useRouter();
    const jobId = params.jobId as string;

    const [job, setJob] = useState<MoeVoteJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) return;

        const fetchJob = async () => {
            try {
                const response = await fetch(`/api/moe-vote/${jobId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch vote job');
                }
                const data = await response.json();
                setJob(data);
                setLoading(false);

                // Poll if still running
                if (data.status === 'pending' || data.status === 'running') {
                    setTimeout(fetchJob, 3000);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                setLoading(false);
            }
        };

        fetchJob();
    }, [jobId]);

    if (loading && !job) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading vote results...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                        <h2 className="text-xl font-bold text-red-900 dark:text-red-300 mb-2">Error</h2>
                        <p className="text-red-700 dark:text-red-400">{error || 'Job not found'}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const agentScores = job.result?.scores ? Object.values(job.result.scores) : [];
    const sortedAgents = [...agentScores].sort((a, b) => b.averageScore - a.averageScore);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.push('/')}
                        className="text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center"
                    >
                        ← Back to Home
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">MoE Discussion Result</h1>
                </div>

                {/* Question Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Question</h2>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">{job.question}</p>
                </div>

                {/* Status */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Status</h2>
                        <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${job.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : job.status === 'failed'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}
                        >
                            {job.status.toUpperCase()}
                        </span>
                    </div>

                    {job.progress && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <span>
                                    Round {job.progress.currentRound} of {job.progress.totalRounds}
                                </span>
                                <span className="capitalize">{job.progress.phase}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                    style={{
                                        width: `${(job.progress.currentRound / job.progress.totalRounds) * 100}%`,
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {(job.status === 'pending' || job.status === 'running') && (
                        <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <span>Processing vote...</span>
                        </div>
                    )}

                    {job.error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
                            <p className="text-red-700 dark:text-red-400">{job.error}</p>
                        </div>
                    )}
                </div>

                {/* Results */}
                {job.status === 'completed' && job.result && (
                    <>
                        {/* Final Decision */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Final Decision
                            </h2>
                            <div className={`rounded-lg p-8 border-2 ${job.result.finalDecision === 'yes'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                                }`}>
                                <div className="text-center">
                                    <div className="text-6xl mb-4">
                                        {job.result.finalDecision === 'yes' ? '✓' : '✗'}
                                    </div>
                                    <p className={`text-4xl font-bold mb-3 ${job.result.finalDecision === 'yes'
                                        ? 'text-green-700 dark:text-green-400'
                                        : 'text-red-700 dark:text-red-400'
                                        }`}>
                                        {job.result.finalDecision.toUpperCase()}
                                    </p>
                                    <p className="text-lg text-gray-600 dark:text-gray-400">
                                        Confidence: {job.result.confidence}%
                                    </p>

                                    {job.result.decisionThought && (
                                        <div className="mt-6 text-left bg-black/5 dark:bg-white/5 rounded-lg p-4">
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                                                Reasoning
                                            </h3>
                                            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                {job.result.decisionThought}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Winner */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                🏆 Winner
                            </h2>
                            <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-6 border-2 border-yellow-300 dark:border-yellow-700">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {job.result.winner.agentName}
                                    </p>
                                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
                                        Average Score: <span className="font-semibold">{job.result.winner.averageScore.toFixed(2)}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Agent Rankings */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Agent Rankings
                            </h2>
                            <div className="space-y-4">
                                {sortedAgents.map((agent, index) => (
                                    <div
                                        key={agent.agentId}
                                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                                                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {agent.agentName}
                                                </span>
                                            </div>
                                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                {agent.averageScore.toFixed(2)}
                                            </span>
                                        </div>

                                        {/* Individual Votes */}
                                        <div className="mt-3 space-y-2">
                                            {agent.votes.map((vote) => (
                                                <div
                                                    key={vote.voterId}
                                                    className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 text-sm"
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                                            {vote.voterName}
                                                        </span>
                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                            Score: {vote.score}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 dark:text-gray-400 text-xs">
                                                        {vote.justification}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Discussion Summary */}
                        {job.result.discussionSummary && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Discussion Summary
                                </h2>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                            {job.result.discussionSummary.roundCount}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Rounds</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                                            {job.result.discussionSummary.totalMessages}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Messages</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                            {job.result.discussionSummary.toolCallsUsed}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Tool Calls</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Metadata */}
                <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                    <p>Job ID: {job.jobId}</p>
                    <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
                    {job.completedAt && <p>Completed: {new Date(job.completedAt).toLocaleString()}</p>}
                </div>
            </div>
        </div>
    );
}
