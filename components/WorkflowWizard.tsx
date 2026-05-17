'use client';

import { useEffect, useState } from 'react';
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
  sceneExecutionJobs?: Array<{
    id: string;
    status: string;
    sceneOutlineId?: string | null;
    sceneId?: string | null;
    outlineIndex: number;
    currentRound?: number | null;
    currentAgentName?: string | null;
    currentPhase?: string | null;
    error?: string | null;
  }>;
  visualAssetJobs?: Array<{
    id: string;
    status: string;
    assetType: string;
    stylesJson: string;
    title: string;
    prompt: string;
    codexPrompt: string;
    codexCommand: string;
    executionCommand?: string | null;
    result?: string | null;
    error?: string | null;
    createdAt?: string | Date;
    scene?: { heading: string; sceneNumber: number } | null;
    character?: { name: string } | null;
  }>;
  videoGenerationJobs?: Array<{
    id: string;
    status: string;
    title: string;
    ratio: string;
    durationSeconds?: number | null;
    sourceImagePathsJson: string;
    prompt: string;
    doubaoInputJson: string;
    inputJsonPath?: string | null;
    doubaoCommand: string;
    executionCommand?: string | null;
    outputDir?: string | null;
    result?: string | null;
    error?: string | null;
    createdAt?: string | Date;
    scene?: { heading: string; sceneNumber: number } | null;
    visualAssetJob?: { title: string; assetType: string } | null;
  }>;
  qualityReviewJobs?: Array<{
    id: string;
    status: string;
    targetType: string;
    targetId: string;
    title: string;
    score?: number | null;
    aiFeel?: string | null;
    industryLevel?: string | null;
    passed: boolean;
    summary?: string | null;
    issuesJson: string;
    repairInstructions?: string | null;
    error?: string | null;
    scene?: { heading: string; sceneNumber: number } | null;
    visualAssetJob?: { title: string; assetType: string } | null;
    videoGenerationJob?: { title: string; ratio: string } | null;
  }>;
  productionPipelineRuns?: Array<{
    id: string;
    status: string;
    level: string;
    sceneIdsJson: string;
    optionsJson: string;
    resultJson?: string | null;
    error?: string | null;
    createdAt?: string | Date;
    completedAt?: string | Date | null;
  }>;
}

interface SceneExecutionJobState {
  id: string;
  status: string;
  sceneOutlineId?: string | null;
  sceneId?: string | null;
  outlineIndex: number;
  currentRound?: number | null;
  currentAgentName?: string | null;
  currentPhase?: string | null;
  error?: string | null;
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
  const [activeSceneJob, setActiveSceneJob] = useState<SceneExecutionJobState | null>(() => {
    return (
      movie.sceneExecutionJobs?.find((job) =>
        job.status === 'pending' || job.status === 'running'
      ) ?? null
    );
  });
  const [feedback, setFeedback] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [visualAssetTypes, setVisualAssetTypes] = useState<string[]>(['storyboard']);
  const [visualStyles, setVisualStyles] = useState<string[]>(['live_action']);
  const [visualSceneIds, setVisualSceneIds] = useState<string[]>([]);
  const [visualCharacterIds, setVisualCharacterIds] = useState<string[]>([]);
  const [visualNotes, setVisualNotes] = useState('');
  const [visualRun, setVisualRun] = useState(false);
  const [visualLoading, setVisualLoading] = useState(false);
  const [videoVisualAssetIds, setVideoVisualAssetIds] = useState<string[]>([]);
  const [videoSceneIds, setVideoSceneIds] = useState<string[]>([]);
  const [videoSourceImagePaths, setVideoSourceImagePaths] = useState('');
  const [videoRatio, setVideoRatio] = useState('16:9');
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(10);
  const [videoProfileIds, setVideoProfileIds] = useState('1');
  const [videoNotes, setVideoNotes] = useState('');
  const [videoRun, setVideoRun] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [pipelineLevel, setPipelineLevel] = useState<'quick' | 'director' | 'producer'>('quick');
  const [pipelineSceneIds, setPipelineSceneIds] = useState<string[]>(() => {
    const firstFinalized = movie.scenes.find((scene) => scene.finalizedScript?.trim());
    return firstFinalized ? [firstFinalized.id] : [];
  });
  const [pipelineRunVisual, setPipelineRunVisual] = useState(false);
  const [pipelineRunVideo, setPipelineRunVideo] = useState(false);
  const [pipelineRunQuality, setPipelineRunQuality] = useState(true);
  const [pipelineNotes, setPipelineNotes] = useState('');
  const [pipelineLoading, setPipelineLoading] = useState(false);

  const refresh = () => router.refresh();

  const visualAssetOptions = [
    { value: 'comic', label: '漫画页' },
    { value: 'storyboard', label: '分镜图' },
    { value: 'character_look', label: '角色定妆照' },
    { value: 'keyframe', label: '电影关键帧' },
    { value: 'environment', label: '环境设定图' },
  ];

  const visualStyleOptions = [
    { value: 'live_action', label: '真人' },
    { value: 'cg_animation', label: 'CG 动画' },
    { value: 'animation', label: '动画' },
    { value: 'manga', label: '漫画' },
    { value: 'ink_storyboard', label: '黑白分镜' },
    { value: 'photorealistic', label: '照片级写实' },
    { value: 'concept_art', label: '概念设定' },
  ];

  const videoRatioOptions = ['16:9', '9:16', '1:1', '4:3', '3:4'];
  const pipelineLevelOptions = [
    { value: 'quick', label: '快速模式', detail: '1 张关键帧 + 1 条 8 秒视频' },
    { value: 'director', label: '导演模式', detail: '关键帧、分镜、环境 + 1 条视频' },
    { value: 'producer', label: '制片模式', detail: '导演包 + 角色定妆 + 1 条视频' },
  ] as const;

  const toggleSelection = (value: string, current: string[], setter: (values: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  useEffect(() => {
    if (!activeSceneJob || !['pending', 'running'].includes(activeSceneJob.status)) {
      return;
    }

    let cancelled = false;
    const pollJob = async () => {
      try {
        const res = await fetch(
          `/api/movies/${movie.id}/scenes/execute?jobId=${activeSceneJob.id}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch scene job');
        }
        if (cancelled) return;

        setActiveSceneJob(data.job);
        if (data.job.status === 'completed') {
          setExecutingSceneId(null);
          setLoading(false);
          refresh();
        } else if (data.job.status === 'failed') {
          setExecutingSceneId(null);
          setLoading(false);
          setError(data.job.error || '场景生成失败');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '场景任务状态获取失败');
        }
      }
    };

    pollJob();
    const timer = window.setInterval(pollJob, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSceneJob?.id, activeSceneJob?.status, movie.id]);

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
      const data = await res.json();
      setActiveSceneJob({
        id: data.jobId,
        status: data.status || 'pending',
        outlineIndex: index,
        currentPhase: 'queued',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
      setExecutingSceneId(null);
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

  const handleCreateVisualAssets = async () => {
    setVisualLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/visual-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetTypes: visualAssetTypes,
          styles: visualStyles,
          sceneIds: visualSceneIds,
          characterIds: visualCharacterIds,
          notes: visualNotes,
          run: visualRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleRunVisualJob = async (jobId: string) => {
    setVisualLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/visual-assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleCreateVideoJobs = async () => {
    setVideoLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/video-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualAssetJobIds: videoVisualAssetIds,
          sceneIds: videoSceneIds,
          sourceImagePaths: videoSourceImagePaths
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
          ratio: videoRatio,
          durationSeconds: videoDurationSeconds,
          profileIds: videoProfileIds,
          notes: videoNotes,
          run: videoRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleRunVideoJob = async (jobId: string) => {
    setVideoLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/video-assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, profileIds: videoProfileIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleCreateQualityReview = async (targetType: string, targetId: string) => {
    setQualityLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/quality-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, run: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setQualityLoading(false);
    }
  };

  const handleRunProductionPipeline = async () => {
    setPipelineLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/production-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: pipelineLevel,
          sceneIds: pipelineSceneIds,
          styles: visualStyles,
          runVisual: pipelineRunVisual,
          runVideo: pipelineRunVideo,
          runQuality: pipelineRunQuality,
          profileIds: videoProfileIds,
          notes: pipelineNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown');
    } finally {
      setPipelineLoading(false);
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
  const isSceneExecuting =
    !!activeSceneJob && (activeSceneJob.status === 'pending' || activeSceneJob.status === 'running');

  const formatSceneJobStatus = (job: SceneExecutionJobState) => {
    const phaseMap: Record<string, string> = {
      queued: '排队中',
      creating_scene: '创建场景',
      director: '导演概要',
      rounds: '角色表演',
      synthesizing: '整理剧本',
      completed: '完成',
    };
    const phase = phaseMap[job.currentPhase || 'queued'] || job.currentPhase || '运行中';
    const details = [
      job.currentRound ? `第 ${job.currentRound} 轮` : null,
      job.currentAgentName ? job.currentAgentName : null,
    ].filter(Boolean);
    return details.length ? `${phase} · ${details.join(' · ')}` : phase;
  };

  const parseIssues = (value: string) => {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  };

  const parsePipelineRun = (value?: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const countPipelineScenes = (run: { sceneIdsJson: string; resultJson?: string | null }) => {
    const parsed = parsePipelineRun(run.resultJson);
    if (Array.isArray(parsed?.scenes)) return parsed.scenes.length;
    try {
      const sceneIds = JSON.parse(run.sceneIdsJson || '[]');
      return Array.isArray(sceneIds) ? sceneIds.length : 0;
    } catch {
      return 0;
    }
  };

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
              const sceneJob =
                activeSceneJob?.outlineIndex === index ||
                activeSceneJob?.sceneOutlineId === outline.id
                  ? activeSceneJob
                  : null;
              return (
                <div
                  key={outline.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <h3 className="font-medium">
                    Scene {index + 1}: {outline.title}
                  </h3>
                  {!scene ? (
                    <div className="mt-2 space-y-2">
                      {sceneJob && (
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          任务状态: {formatSceneJobStatus(sceneJob)}
                        </p>
                      )}
                      <div className="space-x-2">
                        <button
                          onClick={() => handleLoadSceneContext(index)}
                          disabled={loading}
                          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 rounded"
                        >
                          查看 Context
                        </button>
                        <button
                          onClick={() => handleExecuteScene(index)}
                          disabled={loading || isSceneExecuting || !!executingSceneId}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {sceneJob ? '生成中...' : '开始生成'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-sm text-green-600 dark:text-green-400">
                        状态: {scene.status}
                      </p>
                      {scene.finalizedScript && (
                        <>
                          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {scene.finalizedScript.substring(0, 500)}...
                          </pre>
                          <button
                            type="button"
                            onClick={() => handleCreateQualityReview('script', scene.id)}
                            disabled={qualityLoading}
                            className="mt-2 px-3 py-1 text-xs bg-slate-900 text-white rounded disabled:opacity-50"
                          >
                            质检剧本
                          </button>
                        </>
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

      {(displayPhase === 'scene_execution' || displayPhase === 'completed') && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">自动产制流水线</h2>
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {pipelineLevelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPipelineLevel(option.value)}
                  className={`text-left p-3 border rounded-lg ${
                    pipelineLevel === option.value
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <span className="block font-medium text-sm text-gray-900 dark:text-white">{option.label}</span>
                  <span className="block mt-1 text-xs text-gray-500">{option.detail}</span>
                </button>
              ))}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">场景范围（默认选中第一场已生成终稿）</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {movie.scenes.map((scene) => (
                  <label key={scene.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={pipelineSceneIds.includes(scene.id)}
                      onChange={() => toggleSelection(scene.id, pipelineSceneIds, setPipelineSceneIds)}
                    />
                    Scene {scene.sceneNumber}: {scene.heading}
                    {!scene.finalizedScript?.trim() && <span className="text-xs text-amber-600">未出终稿</span>}
                  </label>
                ))}
              </div>
            </div>

            <textarea
              value={pipelineNotes}
              onChange={(event) => setPipelineNotes(event.target.value)}
              placeholder="产制补充要求，如：整体更克制、角色服装保持一致、不要字幕、动作幅度更小"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={pipelineRunQuality}
                  onChange={(event) => setPipelineRunQuality(event.target.checked)}
                />
                自动 LLM 质检
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={pipelineRunVisual}
                  onChange={(event) => setPipelineRunVisual(event.target.checked)}
                />
                同步执行图片生成
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={pipelineRunVideo}
                  onChange={(event) => setPipelineRunVideo(event.target.checked)}
                />
                同步执行 Doubao 视频
              </label>
            </div>

            <button
              onClick={handleRunProductionPipeline}
              disabled={pipelineLoading || pipelineSceneIds.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {pipelineLoading ? '流水线执行中...' : '运行产制流水线'}
            </button>

            {!!movie.productionPipelineRuns?.length && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-white">最近流水线</h3>
                {movie.productionPipelineRuns.map((run) => {
                  const parsed = parsePipelineRun(run.resultJson);
                  const sceneCount = countPipelineScenes(run);
                  return (
                    <div key={run.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {pipelineLevelOptions.find((item) => item.value === run.level)?.label || run.level}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {run.status} · {sceneCount} 场
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${
                          run.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>
                          {run.status}
                        </span>
                      </div>
                      {run.error && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{run.error}</p>
                      )}
                      {parsed && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">查看流水线结果</summary>
                          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(parsed, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {(displayPhase === 'scene_execution' || displayPhase === 'completed') && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">视觉资产生成</h2>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">资产类型（可多选）</p>
              <div className="flex flex-wrap gap-2">
                {visualAssetOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleSelection(option.value, visualAssetTypes, setVisualAssetTypes)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      visualAssetTypes.includes(option.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">视觉风格（可多选）</p>
              <div className="flex flex-wrap gap-2">
                {visualStyleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleSelection(option.value, visualStyles, setVisualStyles)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      visualStyles.includes(option.value)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">场景范围（不选则默认前 3 场/大纲）</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {movie.scenes.map((scene) => (
                    <label key={scene.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={visualSceneIds.includes(scene.id)}
                        onChange={() => toggleSelection(scene.id, visualSceneIds, setVisualSceneIds)}
                      />
                      Scene {scene.sceneNumber}: {scene.heading}
                    </label>
                  ))}
                  {movie.scenes.length === 0 && (
                    <p className="text-sm text-gray-500">还没有已创建场景，将使用场景大纲生成。</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">角色范围（用于定妆照，不选则全部角色）</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {movie.characters.map((character) => (
                    <label key={character.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={visualCharacterIds.includes(character.id)}
                        onChange={() => toggleSelection(character.id, visualCharacterIds, setVisualCharacterIds)}
                      />
                      {character.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <textarea
              value={visualNotes}
              onChange={(event) => setVisualNotes(event.target.value)}
              placeholder="附加视觉要求，如：更像 90 年代港片、减少文字、16:9、主角服装保持黑色西装"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={visualRun}
                onChange={(event) => setVisualRun(event.target.checked)}
              />
              创建后立即调用 Codex imagegen 生成图片
            </label>

            <button
              onClick={handleCreateVisualAssets}
              disabled={visualLoading || visualAssetTypes.length === 0 || visualStyles.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {visualLoading ? '处理中...' : '生成视觉资产任务'}
            </button>

            {!!movie.visualAssetJobs?.length && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-white">最近任务</h3>
                {movie.visualAssetJobs.map((job) => (
                  <div key={job.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{job.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {job.status} · {job.character?.name || job.scene?.heading || '全片'} · {job.assetType}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreateQualityReview('visual_asset', job.id)}
                          disabled={qualityLoading}
                          className="px-3 py-1 text-xs bg-slate-700 text-white rounded disabled:opacity-50"
                        >
                          质检
                        </button>
                        <button
                          onClick={() => handleRunVisualJob(job.id)}
                          disabled={visualLoading || job.status === 'running'}
                          className="px-3 py-1 text-xs bg-gray-900 text-white rounded disabled:opacity-50"
                        >
                          {job.status === 'running' ? '运行中' : '执行'}
                        </button>
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">查看 prompt / command</summary>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap overflow-x-auto">
                        {job.codexCommand}
                      </pre>
                      {job.error && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{job.error}</p>
                      )}
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {(displayPhase === 'scene_execution' || displayPhase === 'completed') && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">视频生成</h2>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">基于视觉资产生成视频 prompt</p>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {(movie.visualAssetJobs || []).map((job) => (
                  <label key={job.id} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={videoVisualAssetIds.includes(job.id)}
                      onChange={() => toggleSelection(job.id, videoVisualAssetIds, setVideoVisualAssetIds)}
                      className="mt-1"
                    />
                    <span>
                      {job.title}
                      <span className="block text-xs text-gray-500">
                        {job.status} · {job.character?.name || job.scene?.heading || '全片'} · {job.assetType}
                      </span>
                    </span>
                  </label>
                ))}
                {(!movie.visualAssetJobs || movie.visualAssetJobs.length === 0) && (
                  <p className="text-sm text-gray-500">还没有视觉资产任务，也可以直接选择场景生成纯文本视频 prompt。</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">直接选择场景（可选）</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {movie.scenes.map((scene) => (
                  <label key={scene.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={videoSceneIds.includes(scene.id)}
                      onChange={() => toggleSelection(scene.id, videoSceneIds, setVideoSceneIds)}
                    />
                    Scene {scene.sceneNumber}: {scene.heading}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">比例</label>
                <select
                  value={videoRatio}
                  onChange={(event) => setVideoRatio(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                >
                  {videoRatioOptions.map((ratio) => (
                    <option key={ratio} value={ratio}>{ratio}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">时长（秒）</label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={videoDurationSeconds}
                  onChange={(event) => setVideoDurationSeconds(Number(event.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doubao profile ids</label>
                <input
                  type="text"
                  value={videoProfileIds}
                  onChange={(event) => setVideoProfileIds(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                />
              </div>
            </div>

            <textarea
              value={videoSourceImagePaths}
              onChange={(event) => setVideoSourceImagePaths(event.target.value)}
              placeholder="参考图本地路径，每行一个；如果图片任务结果里能解析到本地图片路径，会自动附带"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />

            <textarea
              value={videoNotes}
              onChange={(event) => setVideoNotes(event.target.value)}
              placeholder="附加视频要求，如：镜头从近景慢慢拉远、保留角色表情、不要字幕、动作更克制"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={videoRun}
                onChange={(event) => setVideoRun(event.target.checked)}
              />
              创建后立即调用 Doubao 视频任务
            </label>

            <button
              onClick={handleCreateVideoJobs}
              disabled={videoLoading || (videoVisualAssetIds.length === 0 && videoSceneIds.length === 0)}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
            >
              {videoLoading ? '处理中...' : '生成视频任务'}
            </button>

            {!!movie.videoGenerationJobs?.length && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-white">最近视频任务</h3>
                {movie.videoGenerationJobs.map((job) => (
                  <div key={job.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{job.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {job.status} · {job.ratio} · {job.durationSeconds || '默认'} 秒 · {job.visualAssetJob?.title || job.scene?.heading || '全片'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreateQualityReview('video', job.id)}
                          disabled={qualityLoading}
                          className="px-3 py-1 text-xs bg-slate-700 text-white rounded disabled:opacity-50"
                        >
                          质检
                        </button>
                        <button
                          onClick={() => handleRunVideoJob(job.id)}
                          disabled={videoLoading || job.status === 'running'}
                          className="px-3 py-1 text-xs bg-gray-900 text-white rounded disabled:opacity-50"
                        >
                          {job.status === 'running' ? '运行中' : '执行'}
                        </button>
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">查看 prompt / doubao command</summary>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap overflow-x-auto">
                        {job.prompt}
                      </pre>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap overflow-x-auto">
                        {job.doubaoCommand}
                      </pre>
                      {job.outputDir && (
                        <p className="mt-2 text-xs text-gray-500">输出目录：{job.outputDir}</p>
                      )}
                      {job.error && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{job.error}</p>
                      )}
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {(displayPhase === 'scene_execution' || displayPhase === 'completed') && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">质量校验</h2>
          {movie.qualityReviewJobs?.length ? (
            <div className="space-y-3">
              {movie.qualityReviewJobs.map((job) => {
                const issues = parseIssues(job.issuesJson);
                return (
                  <div key={job.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{job.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {job.status} · {job.targetType} · {job.passed ? '通过' : '未通过'} · {job.score ?? '-'} 分 · AI味 {job.aiFeel || '-'} · {job.industryLevel || '-'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        job.passed
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {job.passed ? '可用级' : '需修复'}
                      </span>
                    </div>
                    {job.summary && (
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{job.summary}</p>
                    )}
                    {!!issues.length && (
                      <ul className="mt-2 list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {issues.slice(0, 4).map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    )}
                    {job.repairInstructions && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">修复建议</summary>
                        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap overflow-x-auto">
                          {job.repairInstructions}
                        </pre>
                      </details>
                    )}
                    {job.error && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">{job.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">还没有质量校验记录。可在剧本、视觉资产、视频任务旁点击“质检”。</p>
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
