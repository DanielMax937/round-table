'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Movie {
  id: string;
  title: string;
  theme?: string | null;
  workflowPhase: string;
  storyProposalJson?: string | null;
  storyProposalsJson?: string | null;
  plotSummary?: string | null;
  characters: Array<{
    id: string;
    name: string;
    backstory: string;
    personalityTraits: string;
    surfaceGoal?: string | null;
    deepMotivation?: string | null;
    fatalFlaw?: string | null;
    signatureLanguageStyle?: string | null;
  }>;
  sceneOutlines?: Array<{
    id: string;
    sortOrder: number;
    title: string;
    contentSummary: string;
    emotionalGoal: string;
    characterIdsJson: string;
  }>;
  scenes: Array<{
    id: string;
    sceneNumber: number;
    heading: string;
    status: string;
    finalizedScript: string | null;
    sceneOutlineId?: string | null;
  }>;
}

export default function WorkflowWizard({ movie }: { movie: Movie }) {
  const router = useRouter();
  const [phase, setPhase] = useState(movie.workflowPhase);
  const [proposals, setProposals] = useState<any[]>(() => {
    try {
      return JSON.parse(movie.storyProposalsJson || '[]');
    } catch {
      return [];
    }
  });
  const [selectedProposalIndex, setSelectedProposalIndex] = useState<number | null>(null);
  const [outlines, setOutlines] = useState<any[]>([]);
  const effectiveOutlines = outlines.length > 0 ? outlines : (movie.sceneOutlines || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneContext, setSceneContext] = useState<any>(null);
  const [executingSceneId, setExecutingSceneId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [rewriting, setRewriting] = useState(false);

  const refresh = () => router.refresh();

  // Phase 1: Generate proposals
  const handleGenerateProposals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/story-proposals`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setProposals(data.proposals || []);
      setPhase('proposals');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setLoading(false);
    }
  };

  // Confirm story
  const handleConfirmStory = async () => {
    if (selectedProposalIndex == null) {
      setError('请选择一个故事提案');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/confirm-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalIndex: selectedProposalIndex }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setPhase('characters');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setLoading(false);
    }
  };

  // Generate characters
  const handleGenerateCharacters = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/characters/generate`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setPhase('characters');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setLoading(false);
    }
  };

  // Generate outline
  const handleGenerateOutline = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/outline`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setOutlines(data.outlines || []);
      setPhase('outline');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setLoading(false);
    }
  };

  // Confirm outline
  const handleConfirmOutline = async () => {
    setLoading(true);
    setError('');
    try {
      await fetch(`/api/movies/${movie.id}/confirm-outline`, { method: 'POST' });
      setPhase('scene_execution');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setLoading(false);
    }
  };

  // Fetch scene context
  const handleLoadSceneContext = async (index: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/scenes/context?outlineIndex=${index}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSceneContext(data.context);
      setCurrentSceneIndex(index);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setLoading(false);
    }
  };

  // Execute scene
  const handleExecuteScene = async (index: number) => {
    setLoading(true);
    setError('');
    setExecutingSceneId('running');
    try {
      const res = await fetch(`/api/movies/${movie.id}/scenes/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlineIndex: index }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      await res.json();
      setExecutingSceneId(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
      setExecutingSceneId(null);
    } finally {
      setLoading(false);
    }
  };

  // Settle and next
  const handleSettleAndNext = async (sceneId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/scenes/${sceneId}/settle`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setSceneContext(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setLoading(false);
    }
  };

  // Rewrite
  const handleRewrite = async (sceneId: string) => {
    if (!feedback.trim()) return;
    setRewriting(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/scenes/${sceneId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setFeedback('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setRewriting(false);
    }
  };

  const storyProposal = movie.storyProposalJson
    ? (() => {
        try {
          return JSON.parse(movie.storyProposalJson);
        } catch {
          return null;
        }
      })()
    : null;

  const displayPhase = phase || movie.workflowPhase;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {movie.title} — AI 剧本创作
      </h1>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Phase: Proposals */}
      {(displayPhase === 'theme' || displayPhase === 'proposals') && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">阶段一：故事提案</h2>
          {proposals.length === 0 ? (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                主题：{movie.theme || '未设置'}
              </p>
              <button
                onClick={handleGenerateProposals}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '生成中...' : '生成 3 个故事提案'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.map((p: any, i: number) => (
                <div
                  key={i}
                  onClick={() => setSelectedProposalIndex(i)}
                  className={`p-4 border rounded-lg cursor-pointer ${
                    selectedProposalIndex === i
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <p className="font-medium">{p.oneLiner}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.coreConflict}</p>
                  <p className="text-sm text-gray-500 mt-1">{p.styleReference}</p>
                </div>
              ))}
              <button
                onClick={handleConfirmStory}
                disabled={loading || selectedProposalIndex == null}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                确认所选提案
              </button>
            </div>
          )}
        </section>
      )}

      {/* Phase: Characters */}
      {(displayPhase === 'characters' || displayPhase === 'outline') && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">阶段二：角色与大纲</h2>
          {movie.characters.length === 0 ? (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                基于确认的故事生成角色档案
              </p>
              <button
                onClick={handleGenerateCharacters}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '生成中...' : '生成角色'}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                已生成 {movie.characters.length} 个角色。可前往{' '}
                <Link href={`/movies/${movie.id}`} className="text-blue-500 underline">
                  传统编辑
                </Link>{' '}
                微调。
              </p>
              {effectiveOutlines.length === 0 ? (
                <button
                  onClick={handleGenerateOutline}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '生成中...' : '生成场景大纲'}
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm">已生成 {effectiveOutlines.length} 个场景大纲</p>
                  <ol className="list-decimal list-inside space-y-2">
                    {effectiveOutlines.map((o: any) => (
                      <li key={o.id} className="text-gray-700 dark:text-gray-300">
                        {o.title} — {o.emotionalGoal}
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={handleConfirmOutline}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    确认大纲，进入场景生成
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Phase: Scene Execution */}
      {displayPhase === 'scene_execution' && effectiveOutlines.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">阶段三：场景生成</h2>
          <div className="space-y-4">
            {effectiveOutlines.map((outline: any, index: number) => {
              const scene = movie.scenes?.find((s: any) => s.sceneOutlineId === outline.id);
              return (
                <div
                  key={outline.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <h3 className="font-medium">
                    Scene {index + 1}: {outline.title}
                  </h3>
                  {!scene ? (
                    <div className="mt-2 space-x-2">
                      <button
                        onClick={() => handleLoadSceneContext(index)}
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 rounded"
                      >
                        查看 Context
                      </button>
                      <button
                        onClick={() => handleExecuteScene(index)}
                        disabled={loading || !!executingSceneId}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {executingSceneId ? '生成中...' : '开始生成'}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-sm text-green-600 dark:text-green-400">
                        状态: {scene.status}
                      </p>
                      {scene.finalizedScript && (
                        <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {scene.finalizedScript.substring(0, 500)}...
                        </pre>
                      )}
                      {scene.status === 'draft' && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={feedback}
                            onChange={e => setFeedback(e.target.value)}
                            placeholder="反馈，如：让A的语气更强硬"
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <button
                            onClick={() => handleRewrite(scene.id)}
                            disabled={rewriting || !feedback.trim()}
                            className="px-3 py-1 text-sm bg-amber-600 text-white rounded"
                          >
                            重写
                          </button>
                          <button
                            onClick={() => handleSettleAndNext(scene.id)}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded"
                          >
                            确认，进入下一场
                          </button>
                        </div>
                      )}
                      {scene.status === 'confirmed' && (
                        <p className="text-sm text-gray-500 mt-1">已确认</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {movie.scenes?.every((s: any) => s.status === 'confirmed' || s.status === 'finalized') &&
            movie.scenes?.length === effectiveOutlines.length && (
              <div className="mt-6">
                <a
                  href={`/api/movies/${movie.id}/export`}
                  download
                  className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  导出终稿
                </a>
              </div>
            )}
        </section>
      )}

      {displayPhase === 'completed' && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">完成</h2>
          <a
            href={`/api/movies/${movie.id}/export`}
            download
            className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            导出终稿
          </a>
        </section>
      )}
    </div>
  );
}
