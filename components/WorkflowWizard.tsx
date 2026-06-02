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
  developmentReportJson?: string | null;
  storyBibleJson?: string | null;
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
    act?: string | null;
    arcName?: string | null;
    arcGoal?: string | null;
    setupPayoff?: string | null;
    requiredMotif?: string | null;
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
    imageUrls?: string[];
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
  novelConversionJobs?: Array<{
    id: string;
    status: string;
    currentChapter?: number | null;
    totalChapters?: number | null;
    chaptersJson?: string | null;
    result?: string | null;
    error?: string | null;
    createdAt?: string | Date;
    startedAt?: string | Date | null;
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

const REQUIRED_VISUAL_ASSET_TYPES = ['character_look', 'environment'];

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
  const [developmentLoading, setDevelopmentLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
  const [sceneStates, setSceneStates] = useState(() => movie.scenes || []);
  const [feedback, setFeedback] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [visualAssetTypes, setVisualAssetTypes] = useState<string[]>(REQUIRED_VISUAL_ASSET_TYPES);
  const [visualStyles, setVisualStyles] = useState<string[]>(['live_action']);
  const [visualSceneIds, setVisualSceneIds] = useState<string[]>([]);
  const [visualCharacterIds, setVisualCharacterIds] = useState<string[]>([]);
  const [visualNotes, setVisualNotes] = useState('');
  const [useFourPartOutline, setUseFourPartOutline] = useState(false);
  const [visualRun, setVisualRun] = useState(false);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualJobs, setVisualJobs] = useState(() => movie.visualAssetJobs || []);
  const [videoVisualAssetIds, setVideoVisualAssetIds] = useState<string[]>([]);
  const [videoSceneIds, setVideoSceneIds] = useState<string[]>([]);
  const [videoSourceImagePaths, setVideoSourceImagePaths] = useState('');
  const [videoRatio, setVideoRatio] = useState('16:9');
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(10);
  const [videoProfileIds, setVideoProfileIds] = useState('1');
  const [videoNotes, setVideoNotes] = useState('');
  const [videoRun, setVideoRun] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoJobs, setVideoJobs] = useState(() => movie.videoGenerationJobs || []);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [batchSceneLoading, setBatchSceneLoading] = useState(false);
  const [batchSceneProgress, setBatchSceneProgress] = useState('');
  const [pipelineLevel, setPipelineLevel] = useState<'quick' | 'director' | 'producer'>('quick');
  const [pipelineSceneIds, setPipelineSceneIds] = useState<string[]>(() => {
    const firstFinalized = movie.scenes.find((scene) => scene.finalizedScript?.trim());
    return firstFinalized ? [firstFinalized.id] : [];
  });
  const [pipelineRunVisual, setPipelineRunVisual] = useState(false);
  const [pipelineRunVideo, setPipelineRunVideo] = useState(false);
  const pipelineRunQuality = true;
  const [pipelineNotes, setPipelineNotes] = useState('');
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [novelJobs, setNovelJobs] = useState(() => movie.novelConversionJobs || []);
  const [novelLoading, setNovelLoading] = useState(false);

  const finalizedSceneCount = sceneStates.filter(
    (scene) =>
      (scene.status === 'confirmed' || scene.status === 'finalized') &&
      !!scene.finalizedScript?.trim()
  ).length;
  const activeNovelJob = novelJobs.find((job) => job.status === 'pending' || job.status === 'running') || null;
  const latestNovelJob = novelJobs[0] || null;
  const latestCompletedNovelJob = novelJobs.find((job) => job.status === 'completed' && job.result?.trim()) || null;
  const hasRunningVisualJobs = visualJobs.some((job) => job.status === 'running');
  const hasRunningVideoJobs = videoJobs.some((job) => job.status === 'running');
  const hasCompletedCharacterLook = movie.characters.length === 0
    || visualJobs.some((job) => job.assetType === 'character_look' && job.status === 'completed');
  const hasCompletedEnvironment = visualJobs.some((job) => job.assetType === 'environment' && job.status === 'completed');
  const hasVisualFoundation = hasCompletedCharacterLook && hasCompletedEnvironment;
  const effectiveVisualAssetTypes = hasVisualFoundation
    ? Array.from(new Set([...REQUIRED_VISUAL_ASSET_TYPES, ...visualAssetTypes]))
    : REQUIRED_VISUAL_ASSET_TYPES;
  const remainingSceneTargets = effectiveOutlines
    .map((outline, index) => ({ outline, index }))
    .filter(({ outline }) => !sceneStates?.some((scene) => scene.sceneOutlineId === outline.id));

  const refresh = () => router.refresh();

  const mergeJobsById = <T extends { id: string }>(current: T[], incoming: T[]) => {
    const incomingIds = new Set(incoming.map((job) => job.id));
    return [...incoming, ...current.filter((job) => !incomingIds.has(job.id))];
  };

  const mergeSceneById = (scene: Movie['scenes'][number]) => {
    setSceneStates((prev) => {
      const exists = prev.some((item) => item.id === scene.id);
      if (!exists) return [...prev, scene].sort((a, b) => a.sceneNumber - b.sceneNumber);
      return prev.map((item) => (item.id === scene.id ? { ...item, ...scene } : item));
    });
  };

  const handleGenerateDevelopment = async (force = false) => {
    setDevelopmentLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/development`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || '生成开发材料失败');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setDevelopmentLoading(false);
    }
  };

  const visualAssetOptions = [
    { value: 'character_look', label: '角色定妆照' },
    { value: 'environment', label: '环境设定图' },
    { value: 'keyframe', label: '电影关键帧' },
    { value: 'storyboard', label: '分镜图' },
    { value: 'comic', label: '漫画页' },
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
    { value: 'quick', label: '快速模式', detail: '定妆/环境 + 1 张关键帧 + 8 秒视频' },
    { value: 'director', label: '导演模式', detail: '定妆/环境 + 关键帧/分镜 + 10 秒视频' },
    { value: 'producer', label: '制片模式', detail: '导演包 + 漫画页 + 12 秒视频' },
  ] as const;

  const toggleSelection = (value: string, current: string[], setter: (values: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const toggleVisualAssetType = (value: string) => {
    if (REQUIRED_VISUAL_ASSET_TYPES.includes(value)) return;
    if (!hasVisualFoundation) return;
    toggleSelection(value, visualAssetTypes, setVisualAssetTypes);
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
          throw new Error(data.error || '获取场景任务失败');
        }
        if (cancelled) return;

        setActiveSceneJob(data.job);
        if (data.job.status === 'completed') {
          const sceneId = data.job.sceneId || data.job.result?.sceneId;
          if (sceneId) {
            fetchSceneForState(sceneId).catch(() => {});
          }
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

  useEffect(() => {
    setSceneStates(movie.scenes || []);
  }, [movie.scenes]);

  useEffect(() => {
    setVisualJobs(movie.visualAssetJobs || []);
  }, [movie.visualAssetJobs]);

  useEffect(() => {
    setVideoJobs(movie.videoGenerationJobs || []);
  }, [movie.videoGenerationJobs]);

  useEffect(() => {
    if (!hasRunningVisualJobs) return;

    let cancelled = false;
    const pollVisualJobs = async () => {
      try {
        const res = await fetch(`/api/movies/${movie.id}/visual-assets`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.details || data.error || '获取视觉资产任务失败');
        if (cancelled) return;

        setVisualJobs(data.jobs || []);
        if (!(data.jobs || []).some((job: { status: string }) => job.status === 'running')) {
          refresh();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '视觉资产任务状态获取失败');
        }
      }
    };

    pollVisualJobs();
    const timer = window.setInterval(pollVisualJobs, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hasRunningVisualJobs, movie.id]);

  useEffect(() => {
    if (!hasRunningVideoJobs) return;

    let cancelled = false;
    const pollVideoJobs = async () => {
      try {
        const res = await fetch(`/api/movies/${movie.id}/video-assets`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.details || data.error || '获取视频任务失败');
        if (cancelled) return;

        setVideoJobs(data.jobs || []);
        if (!(data.jobs || []).some((job: { status: string }) => job.status === 'running')) {
          refresh();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '视频任务状态获取失败');
        }
      }
    };

    pollVideoJobs();
    const timer = window.setInterval(pollVideoJobs, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hasRunningVideoJobs, movie.id]);

  useEffect(() => {
    if (!activeNovelJob) return;

    let cancelled = false;
    const pollNovelJob = async () => {
      try {
        const res = await fetch(
          `/api/movies/${movie.id}/novel?jobId=${activeNovelJob.id}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '获取小说任务失败');
        }
        if (cancelled || !data.job) return;

        setNovelJobs((prev) => {
          const exists = prev.some((job) => job.id === data.job.id);
          if (!exists) return [data.job, ...prev];
          return prev.map((job) => (job.id === data.job.id ? { ...job, ...data.job } : job));
        });

        if (data.job.status === 'completed' || data.job.status === 'failed') {
          refresh();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '小说任务状态获取失败');
        }
      }
    };

    pollNovelJob();
    const timer = window.setInterval(pollNovelJob, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeNovelJob?.id, activeNovelJob?.status, movie.id]);

  // Phase 1: Generate proposals
  const handleGenerateProposals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/story-proposals`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成故事提案失败');
      setProposals(data.proposals || []);
      setPhase('proposals');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
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
      if (!res.ok) throw new Error((await res.json()).error || '确认故事失败');
      setPhase('characters');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const hasDevelopmentMaterials = Boolean(movie.developmentReportJson || movie.storyBibleJson);

  // Generate characters
  const handleGenerateCharacters = async () => {
    if (!hasDevelopmentMaterials) {
      setError('请先点击“生成材料”，完成开发读本 / 故事圣经后再进入阶段二。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/characters/generate`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || '生成角色失败');
      setPhase('characters');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // Generate outline
  const handleGenerateOutline = async () => {
    if (!hasDevelopmentMaterials) {
      setError('请先点击“生成材料”，完成开发读本 / 故事圣经后再生成场景大纲。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useFourPartStructure: useFourPartOutline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成场景大纲失败');
      setOutlines(data.outlines || []);
      setPhase('outline');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // Confirm outline
  const handleConfirmOutline = async () => {
    if (!hasDevelopmentMaterials) {
      setError('请先生成开发材料，再确认大纲进入场景生成。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await fetch(`/api/movies/${movie.id}/confirm-outline`, { method: 'POST' });
      setPhase('scene_execution');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // Fetch scene context
  const handleLoadSceneContext = async (index: number) => {
    if (sceneContext && currentSceneIndex === index) {
      setSceneContext(null);
      setNotice('');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/scenes/context?outlineIndex=${index}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || '获取场景上下文失败');
      setSceneContext(data.context);
      setCurrentSceneIndex(index);
      setNotice(`已加载场景 ${index + 1} 的上下文。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // Execute scene
  const handleExecuteScene = async (index: number) => {
    setLoading(true);
    setError('');
    setNotice('');
    setExecutingSceneId('running');
    try {
      const res = await fetch(`/api/movies/${movie.id}/scenes/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlineIndex: index }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '启动场景生成失败');
      }
      const data = await res.json();
      setActiveSceneJob({
        id: data.jobId,
        status: data.status || 'pending',
        outlineIndex: index,
        currentPhase: 'queued',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      setExecutingSceneId(null);
      setLoading(false);
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const pollSceneJobUntilDone = async (jobId: string) => {
    const timeoutMs = 60 * 60 * 1000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const res = await fetch(`/api/movies/${movie.id}/scenes/execute?jobId=${jobId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || '获取场景任务失败');

      setActiveSceneJob(data.job);
      if (data.job.status === 'completed') return data.job;
      if (data.job.status === 'failed') {
        throw new Error(data.job.error || '场景生成失败');
      }

      await sleep(2500);
    }

    throw new Error('场景生成超时');
  };

  const fetchSceneForState = async (sceneId: string) => {
    const res = await fetch(`/api/movies/${movie.id}/scenes/${sceneId}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.details || data.error || '获取场景失败');
    if (data.scene) mergeSceneById(data.scene);
    return data.scene as Movie['scenes'][number];
  };

  const settleScene = async (sceneId: string) => {
    const res = await fetch(`/api/movies/${movie.id}/scenes/${sceneId}/settle`, {
      method: 'POST',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.details || data.error || '确认场景失败');
    setSceneStates((prev) =>
      prev.map((scene) => (scene.id === sceneId ? { ...scene, status: 'confirmed' } : scene))
    );
    return data;
  };

  const handleGenerateRemainingScenesSequentially = async () => {
    if (remainingSceneTargets.length === 0) {
      setNotice('没有需要生成的剩余场景。');
      return;
    }

    setBatchSceneLoading(true);
    setBatchSceneProgress('');
    setError('');
    setNotice('');

    try {
      for (let i = 0; i < remainingSceneTargets.length; i++) {
        const target = remainingSceneTargets[i];
        setBatchSceneProgress(
          `正在生成第 ${i + 1}/${remainingSceneTargets.length} 个剩余场景：${target.outline.title}`
        );

        const res = await fetch(`/api/movies/${movie.id}/scenes/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outlineIndex: target.index }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.sceneId) continue;
          throw new Error(data.details || data.error || '启动场景生成失败');
        }

        setActiveSceneJob({
          id: data.jobId,
          status: data.status || 'pending',
          outlineIndex: target.index,
          currentPhase: 'queued',
        });

        const completedJob = await pollSceneJobUntilDone(data.jobId);
        const sceneId = completedJob.sceneId || completedJob.result?.sceneId;
        if (sceneId) {
          await fetchSceneForState(sceneId);
          setBatchSceneProgress(
            `正在确认并结算第 ${i + 1}/${remainingSceneTargets.length} 个场景：${target.outline.title}`
          );
          await settleScene(sceneId);
        }
      }

      setActiveSceneJob(null);
      setNotice('剩余场景已按顺序生成并确认。');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量场景生成失败');
    } finally {
      setBatchSceneLoading(false);
      setBatchSceneProgress('');
    }
  };

  // Settle and next
  const handleSettleAndNext = async (sceneId: string) => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await settleScene(sceneId);
      setSceneContext(null);
      setNotice('当前场景已确认，剧情记忆已结算，可以继续生成下一场。');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // Rewrite
  const handleRewrite = async (sceneId: string) => {
    if (!feedback.trim()) return;
    setRewriting(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/scenes/${sceneId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '重写场景失败');
      setFeedback('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setRewriting(false);
    }
  };

  const handleCreateVisualAssets = async () => {
    setVisualLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/visual-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetTypes: effectiveVisualAssetTypes,
          styles: visualStyles,
          sceneIds: visualSceneIds,
          characterIds: visualCharacterIds,
          notes: visualNotes,
          run: visualRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成视觉资产任务失败');
      const incomingJobs = visualRun
        ? (data.jobs || []).map((job: any, index: number) => (index === 0 ? { ...job, status: 'running' } : job))
        : data.jobs || [];
      setVisualJobs((prev) => mergeJobsById(prev, incomingJobs));
      setNotice(
        visualRun
          ? `已创建 ${data.jobs?.length || 0} 个视觉资产任务，并按顺序生成、自动质检和必要时重生。`
          : `已创建 ${data.jobs?.length || 0} 个视觉资产任务，可在最近任务中逐个执行，执行时会自动质检。`
      );
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleRunVisualJob = async (jobId: string) => {
    setVisualLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/visual-assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '执行视觉资产任务失败');
      setVisualJobs((prev) =>
        prev.map((job) => (job.id === jobId ? { ...job, ...data.job, status: data.job?.status || 'running' } : job))
      );
      setNotice('视觉资产任务已开始执行。');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleCreateVideoJobs = async () => {
    setVideoLoading(true);
    setError('');
    setNotice('');
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
      if (!res.ok) throw new Error(data.error || '生成视频任务失败');
      const incomingJobs = videoRun
        ? (data.jobs || []).map((job: any, index: number) => (index === 0 ? { ...job, status: 'running' } : job))
        : data.jobs || [];
      setVideoJobs((prev) => mergeJobsById(prev, incomingJobs));
      setNotice(
        videoRun
          ? `已创建 ${data.jobs?.length || 0} 个视频任务，并按顺序开始执行。`
          : `已创建 ${data.jobs?.length || 0} 个视频任务，可在最近视频任务中逐个执行。`
      );
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleRunVideoJob = async (jobId: string) => {
    setVideoLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/video-assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, profileIds: videoProfileIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '执行视频任务失败');
      setVideoJobs((prev) =>
        prev.map((job) => (job.id === jobId ? { ...job, ...data.job, status: data.job?.status || 'running' } : job))
      );
      setNotice('视频任务已开始执行。');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleCreateQualityReview = async (targetType: string, targetId: string) => {
    setQualityLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/quality-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, run: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建质量校验失败');
      setNotice('质检任务已完成或已开始执行，结果会显示在页面底部的质量校验区域。');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setQualityLoading(false);
    }
  };

  const handleRunProductionPipeline = async () => {
    setPipelineLoading(true);
    setError('');
    setNotice('');
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
      if (!res.ok) throw new Error(data.details || data.error || '运行产制流水线失败');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setPipelineLoading(false);
    }
  };

  const handleStartNovelConversion = async () => {
    setNovelLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/movies/${movie.id}/novel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || '启动小说改编失败');

      setNovelJobs((prev) => [
        {
          id: data.jobId,
          status: data.status || 'pending',
          currentChapter: 0,
          totalChapters: data.totalChapters,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setNovelLoading(false);
    }
  };

  const copyNovelToClipboard = async (content: string) => {
    await navigator.clipboard.writeText(content);
  };

  const downloadNovel = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${movie.title}-小说改编.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
  const developmentReport = movie.developmentReportJson
    ? (() => {
        try {
          return JSON.parse(movie.developmentReportJson);
        } catch {
          return null;
        }
      })()
    : null;
  const storyBible = movie.storyBibleJson
    ? (() => {
        try {
          return JSON.parse(movie.storyBibleJson);
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

  const formatStatus = (status?: string | null) => {
    const statusMap: Record<string, string> = {
      pending: '待处理',
      queued: '排队中',
      running: '运行中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
      draft: '草稿',
      confirmed: '已确认',
      finalized: '已定稿',
      active: '进行中',
      paused: '已暂停',
      archived: '已归档',
    };
    return status ? statusMap[status] || status : '-';
  };

  const formatAssetType = (assetType?: string | null) => {
    return visualAssetOptions.find((option) => option.value === assetType)?.label || assetType || '-';
  };

  const formatTargetType = (targetType?: string | null) => {
    const targetTypeMap: Record<string, string> = {
      script: '剧本',
      visual_asset: '视觉资产',
      video: '视频',
    };
    return targetType ? targetTypeMap[targetType] || targetType : '-';
  };

  const developmentMaterialPanel = storyProposal ? (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">开发读本 / 故事圣经</h2>
          {developmentReport ? (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              诊断 {developmentReport.quickDiagnosis?.grade || '-'}：
              {developmentReport.quickDiagnosis?.reason || '已生成'}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              生成后会作为角色、大纲、场景和小说改编的统一创作约束。
            </p>
          )}
          {storyBible?.controllingIdea && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              中心命题：{storyBible.controllingIdea}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleGenerateDevelopment(false)}
            disabled={developmentLoading}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {developmentLoading ? '生成中...' : developmentReport ? '补全材料' : '生成材料'}
          </button>
          {(developmentReport || storyBible) && (
            <button
              type="button"
              onClick={() => handleGenerateDevelopment(true)}
              disabled={developmentLoading}
              className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              强制重生成
            </button>
          )}
        </div>
      </div>
      {(developmentReport || storyBible) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400">
            查看开发材料
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap overflow-x-auto max-h-80">
            {JSON.stringify({ developmentReport, storyBible }, null, 2)}
          </pre>
        </details>
      )}
    </section>
  ) : null;

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

      {notice && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg text-green-700 dark:text-green-300">
          {notice}
        </div>
      )}

      {developmentMaterialPanel}

      {(displayPhase === 'scene_execution' || displayPhase === 'completed') && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">产制功能</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <a
              href="#novel-production"
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-fuchsia-500 dark:hover:border-fuchsia-500 transition-colors"
            >
              <span className="block text-sm font-medium text-gray-900 dark:text-white">小说改编</span>
              <span className="block mt-1 text-xs text-gray-500">从终稿剧本生成小说章节</span>
            </a>
            <a
              href="#production-pipeline"
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors"
            >
              <span className="block text-sm font-medium text-gray-900 dark:text-white">自动流水线</span>
              <span className="block mt-1 text-xs text-gray-500">剧本质检、图片、视频联动</span>
            </a>
            <a
              href="#visual-assets"
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors"
            >
              <span className="block text-sm font-medium text-gray-900 dark:text-white">分镜 / 视觉资产</span>
              <span className="block mt-1 text-xs text-gray-500">生成分镜图、关键帧、定妆照</span>
            </a>
            <a
              href="#video-generation"
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-rose-500 dark:hover:border-rose-500 transition-colors"
            >
              <span className="block text-sm font-medium text-gray-900 dark:text-white">视频生成</span>
              <span className="block mt-1 text-xs text-gray-500">生成视频提示词和豆包任务</span>
            </a>
            <a
              href="#quality-reviews"
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-slate-500 dark:hover:border-slate-500 transition-colors"
            >
              <span className="block text-sm font-medium text-gray-900 dark:text-white">质量校验</span>
              <span className="block mt-1 text-xs text-gray-500">查看剧本、图片、视频质检结果</span>
            </a>
          </div>
        </section>
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
          {!hasDevelopmentMaterials && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              请先在上方点击“生成材料”，完成开发读本 / 故事圣经后，阶段二按钮才可使用。
            </div>
          )}
          {movie.characters.length === 0 ? (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                基于确认的故事生成角色档案
              </p>
              <button
                onClick={handleGenerateCharacters}
                disabled={loading || !hasDevelopmentMaterials}
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
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={useFourPartOutline}
                      onChange={(event) => setUseFourPartOutline(event.target.checked)}
                      disabled={loading || !hasDevelopmentMaterials}
                    />
                    使用“序 / 破 / 急 / 终”四场结构
                  </label>
                  <button
                    onClick={handleGenerateOutline}
                    disabled={loading || !hasDevelopmentMaterials}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '生成中...' : useFourPartOutline ? '生成四场大纲' : '生成场景大纲'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm">已生成 {effectiveOutlines.length} 个场景大纲</p>
                  <ol className="list-decimal list-inside space-y-2">
                    {effectiveOutlines.map((o: any) => (
                      <li key={o.id} className="text-gray-700 dark:text-gray-300">
                        {o.title} — {o.emotionalGoal}
                        {(o.act || o.arcName || o.setupPayoff || o.requiredMotif) && (
                          <span className="block ml-6 text-xs text-gray-500">
                            {[o.act, o.arcName, o.arcGoal, o.setupPayoff, o.requiredMotif]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={handleConfirmOutline}
                    disabled={loading || !hasDevelopmentMaterials}
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
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">阶段三：场景生成</h2>
              <p className="mt-1 text-sm text-gray-500">
                逐场生成剧本；确认后会结算剧情记忆和角色状态，再进入下一场。
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateRemainingScenesSequentially}
              disabled={batchSceneLoading || isSceneExecuting || loading || remainingSceneTargets.length === 0}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium"
            >
              {batchSceneLoading ? '顺序生成中...' : `一键顺序生成并确认剩余 ${remainingSceneTargets.length} 场`}
            </button>
          </div>
          {batchSceneProgress && (
            <p className="mb-4 text-sm text-violet-700 dark:text-violet-300">{batchSceneProgress}</p>
          )}
          <div className="space-y-4">
            {effectiveOutlines.map((outline: any, index: number) => {
              const scene = sceneStates?.find((s: any) => s.sceneOutlineId === outline.id);
              const sceneJob =
                activeSceneJob?.outlineIndex === index ||
                activeSceneJob?.sceneOutlineId === outline.id
                  ? activeSceneJob
                  : null;
              const sceneInteractionDisabled = batchSceneLoading || isSceneExecuting || loading;
              return (
                <div
                  key={outline.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <h3 className="font-medium">
                    场景 {index + 1}：{outline.title}
                  </h3>
                  {(outline.act || outline.arcName || outline.setupPayoff || outline.requiredMotif) && (
                    <p className="mt-1 text-xs text-gray-500">
                      {[outline.act, outline.arcName, outline.arcGoal, outline.setupPayoff, outline.requiredMotif]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {sceneContext && currentSceneIndex === index && (
                    <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">本场上下文</p>
                      <div className="mt-2 grid gap-2 text-xs text-blue-900 dark:text-blue-100 md:grid-cols-2">
                        <p>剧情目标：{sceneContext.emotionalGoal || '-'}</p>
                        <p>叙事弧线：{[sceneContext.act, sceneContext.arcName, sceneContext.arcGoal].filter(Boolean).join(' · ') || '-'}</p>
                        <p>埋设/回收：{sceneContext.setupPayoff || '-'}</p>
                        <p>必需母题：{sceneContext.requiredMotif || '-'}</p>
                      </div>
                      <p className="mt-2 text-xs text-blue-900 dark:text-blue-100">
                        场景摘要：{sceneContext.contentSummary || '-'}
                      </p>
                      <p className="mt-2 text-xs text-blue-900 dark:text-blue-100">
                        角色：{sceneContext.characters?.map((character: { name: string }) => character.name).join('、') || '-'}
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-blue-700 dark:text-blue-300">查看完整上下文 JSON</summary>
                        <pre className="mt-2 max-h-72 overflow-x-auto whitespace-pre-wrap rounded bg-white/70 dark:bg-gray-900 p-2 text-xs text-gray-800 dark:text-gray-200">
                          {JSON.stringify(sceneContext, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                  {!scene ? (
                    <div className="mt-2 space-y-2">
                      {sceneJob && (
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          任务状态：{formatSceneJobStatus(sceneJob)}
                        </p>
                      )}
                      <div className="space-x-2">
                        <button
                          onClick={() => handleLoadSceneContext(index)}
                          disabled={sceneInteractionDisabled}
                          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 rounded"
                        >
                          {sceneContext && currentSceneIndex === index ? '隐藏上下文' : '查看上下文'}
                        </button>
                        <button
                          onClick={() => handleExecuteScene(index)}
                          disabled={sceneInteractionDisabled || !!executingSceneId}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {sceneJob ? '生成中...' : batchSceneLoading ? '等待顺序生成' : '开始生成'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-sm text-green-600 dark:text-green-400">
                        状态：{formatStatus(scene.status)}
                      </p>
                      {scene.finalizedScript && (
                        <>
                          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {scene.finalizedScript.substring(0, 500)}...
                          </pre>
                          <button
                            type="button"
                            onClick={() => handleCreateQualityReview('script', scene.id)}
                            disabled={qualityLoading || batchSceneLoading || isSceneExecuting}
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
                            disabled={sceneInteractionDisabled || rewriting}
                            className="flex-1 px-2 py-1 border rounded text-sm disabled:opacity-50"
                          />
                          <button
                            onClick={() => handleRewrite(scene.id)}
                            disabled={sceneInteractionDisabled || rewriting || !feedback.trim()}
                            className="px-3 py-1 text-sm bg-amber-600 text-white rounded disabled:opacity-50"
                          >
                            重写
                          </button>
                          <button
                            onClick={() => handleSettleAndNext(scene.id)}
                            disabled={sceneInteractionDisabled}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded disabled:opacity-50"
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

          {sceneStates?.every((s: any) => s.status === 'confirmed' || s.status === 'finalized') &&
            sceneStates?.length === effectiveOutlines.length && (
              <div className="mt-6">
                <p className="mb-2 text-sm text-gray-500">
                  导出终稿会下载所有已确认场景合并后的 TXT 剧本，方便备份、交付或导入外部写作/制片工具。
                </p>
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
        <section id="novel-production" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 scroll-mt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">小说改编</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                将已定稿场景转换成番茄小说风格章节，并自动做章节质检与修复。
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                当前可改编 {finalizedSceneCount} / {sceneStates.length} 场
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartNovelConversion}
              disabled={novelLoading || !!activeNovelJob || finalizedSceneCount === 0}
              className="px-4 py-2 rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm font-medium"
            >
              {activeNovelJob
                ? '小说改编中...'
                : novelLoading
                  ? '启动中...'
                  : latestCompletedNovelJob
                    ? '重新生成小说'
                    : '生成小说'}
            </button>
          </div>

          {finalizedSceneCount === 0 && (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
              需要先完成至少一场终稿剧本，才能开始小说改编。
            </p>
          )}

          {latestNovelJob && (
            <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    最近任务：{formatStatus(latestNovelJob.status)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    章节进度：{latestNovelJob.currentChapter || 0} / {latestNovelJob.totalChapters || finalizedSceneCount || '-'}
                  </p>
                </div>
                {latestNovelJob.status === 'failed' && latestNovelJob.error && (
                  <p className="text-xs text-red-600 dark:text-red-400">{latestNovelJob.error}</p>
                )}
              </div>

              {(latestNovelJob.status === 'pending' || latestNovelJob.status === 'running') && (
                <div className="mt-3 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-fuchsia-600 transition-all"
                    style={{
                      width: `${
                        latestNovelJob.totalChapters
                          ? Math.max(8, Math.min(100, ((latestNovelJob.currentChapter || 0) / latestNovelJob.totalChapters) * 100))
                          : 8
                      }%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {latestCompletedNovelJob?.result && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyNovelToClipboard(latestCompletedNovelJob.result || '')}
                  className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  复制小说
                </button>
                <button
                  type="button"
                  onClick={() => downloadNovel(latestCompletedNovelJob.result || '')}
                  className="px-3 py-1.5 rounded-lg text-sm bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                >
                  下载小说
                </button>
              </div>
              <details>
                <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400">预览小说正文</summary>
                <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-sm whitespace-pre-wrap overflow-x-auto max-h-96">
                  {latestCompletedNovelJob.result}
                </pre>
              </details>
            </div>
          )}
        </section>
      )}

      {(displayPhase === 'scene_execution' || displayPhase === 'completed') && (
        <section id="production-pipeline" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 scroll-mt-6">
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
                {sceneStates.map((scene) => (
                  <label key={scene.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={pipelineSceneIds.includes(scene.id)}
                      onChange={() => toggleSelection(scene.id, pipelineSceneIds, setPipelineSceneIds)}
                    />
                    场景 {scene.sceneNumber}：{scene.heading}
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
                  readOnly
                  disabled
                />
                自动 LLM 质检（固定开启）
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
                同步执行豆包视频
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
                <p className="text-sm text-gray-500">
                  流水线运行结果在这里查看；展开“查看流水线结果”能看到每场创建的图片任务 ID、视频任务 ID 和质检任务 ID。具体图片和视频产物会出现在下方“视觉资产生成”和“视频生成”的最近任务里。
                </p>
                {movie.productionPipelineRuns.map((run) => {
                  const parsed = parsePipelineRun(run.resultJson);
                  const sceneCount = countPipelineScenes(run);
                  const visualCount = Array.isArray(parsed?.scenes)
                    ? parsed.scenes.reduce((sum: number, scene: any) => sum + (Array.isArray(scene.visualAssetJobIds) ? scene.visualAssetJobIds.length : 0), 0)
                    : 0;
                  const videoCount = Array.isArray(parsed?.scenes)
                    ? parsed.scenes.reduce((sum: number, scene: any) => sum + (Array.isArray(scene.videoGenerationJobIds) ? scene.videoGenerationJobIds.length : 0), 0)
                    : 0;
                  return (
                    <div key={run.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {pipelineLevelOptions.find((item) => item.value === run.level)?.label || run.level}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatStatus(run.status)} · {sceneCount} 场 · 图片任务 {visualCount} · 视频任务 {videoCount}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${
                          run.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>
                          {formatStatus(run.status)}
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
        <section id="visual-assets" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 scroll-mt-6">
          <h2 className="text-lg font-semibold mb-4">视觉资产生成</h2>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">资产类型（可多选）</p>
              <div className="flex flex-wrap gap-2">
                {visualAssetOptions.map((option) => {
                  const required = REQUIRED_VISUAL_ASSET_TYPES.includes(option.value);
                  const selected = effectiveVisualAssetTypes.includes(option.value);
                  const disabled = !required && !hasVisualFoundation;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleVisualAssetType(option.value)}
                      disabled={disabled}
                      className={`px-3 py-1 rounded-full text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {option.label}{required ? '（必选）' : ''}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                角色定妆照和环境设定图固定前置，用于锁定角色脸、服装、场景空间和影调；两者完成前只会生成这两类图片，完成后才能选择关键帧、分镜图或漫画页。
              </p>
              {!hasVisualFoundation && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                  当前还缺少{!hasCompletedCharacterLook ? '角色定妆照' : ''}{!hasCompletedCharacterLook && !hasCompletedEnvironment ? '和' : ''}{!hasCompletedEnvironment ? '环境设定图' : ''}，请先生成并确认前置资产。
                </p>
              )}
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
                  {sceneStates.map((scene) => (
                    <label key={scene.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={visualSceneIds.includes(scene.id)}
                        onChange={() => toggleSelection(scene.id, visualSceneIds, setVisualSceneIds)}
                      />
                      场景 {scene.sceneNumber}：{scene.heading}
                    </label>
                  ))}
                  {sceneStates.length === 0 && (
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
              创建后按顺序调用 Codex imagegen 生成图片
            </label>

            <button
              onClick={handleCreateVisualAssets}
              disabled={visualLoading || hasRunningVisualJobs || effectiveVisualAssetTypes.length === 0 || visualStyles.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {visualLoading ? '处理中...' : hasVisualFoundation ? '生成视觉资产任务' : '生成前置定妆/环境任务'}
            </button>

            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-white">最近任务</h3>
              {visualJobs.length ? (
                visualJobs.map((job) => {
                  const imageUrls = job.imageUrls || [];
                  return (
                    <div key={job.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{job.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatStatus(job.status)} · {job.character?.name || job.scene?.heading || '全片'} · {formatAssetType(job.assetType)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreateQualityReview('visual_asset', job.id)}
                            disabled={qualityLoading || job.status === 'running'}
                            className="px-3 py-1 text-xs bg-slate-700 text-white rounded disabled:opacity-50"
                          >
                            质检图片
                          </button>
                          <button
                            onClick={() => handleRunVisualJob(job.id)}
                            disabled={visualLoading || hasRunningVisualJobs || job.status === 'running'}
                            className="px-3 py-1 text-xs bg-gray-900 text-white rounded disabled:opacity-50"
                          >
                            {job.status === 'running' ? '运行中' : job.status === 'failed' ? '重新执行' : '执行'}
                          </button>
                        </div>
                      </div>

                      {job.status === 'running' && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                          图片生成中，页面会自动刷新任务状态。
                        </p>
                      )}

                      {job.status === 'failed' && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                          生成失败，任务已停止。{job.error || '可点击“重新执行”再次生成。'}
                        </p>
                      )}

                      {imageUrls.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {imageUrls.map((url, index) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                              <img
                                src={url}
                                alt={`${job.title} 生成图片 ${index + 1}`}
                                className="h-52 w-full object-contain"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      )}

                      {job.status === 'completed' && imageUrls.length === 0 && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                          任务已完成，但没有在输出目录找到可展示的 PNG/JPG/WebP 文件。请展开命令结果检查保存路径。
                        </p>
                      )}

                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">查看提示词 / 命令 / 结果</summary>
                        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap overflow-x-auto">
                          {job.codexCommand}
                        </pre>
                        {job.result && (
                          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs whitespace-pre-wrap overflow-x-auto">
                            {job.result}
                          </pre>
                        )}
                        {job.error && (
                          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{job.error}</p>
                        )}
                      </details>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">
                  还没有视觉资产任务。点击“生成视觉资产任务”后，任务会显示在这里。
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {(displayPhase === 'scene_execution' || displayPhase === 'completed') && (
        <section id="video-generation" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 scroll-mt-6">
          <h2 className="text-lg font-semibold mb-4">视频生成</h2>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">基于视觉资产生成视频提示词</p>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {visualJobs.map((job) => (
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
                        {formatStatus(job.status)} · {job.character?.name || job.scene?.heading || '全片'} · {formatAssetType(job.assetType)}
                      </span>
                    </span>
                  </label>
                ))}
                {visualJobs.length === 0 && (
                  <p className="text-sm text-gray-500">还没有视觉资产任务，也可以直接选择场景生成纯文本视频提示词。</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">直接选择场景（可选）</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {sceneStates.map((scene) => (
                  <label key={scene.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={videoSceneIds.includes(scene.id)}
                      onChange={() => toggleSelection(scene.id, videoSceneIds, setVideoSceneIds)}
                    />
                    场景 {scene.sceneNumber}：{scene.heading}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">豆包配置 ID</label>
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
              创建后按顺序调用豆包视频任务
            </label>

            <button
              onClick={handleCreateVideoJobs}
              disabled={videoLoading || hasRunningVideoJobs || (videoVisualAssetIds.length === 0 && videoSceneIds.length === 0)}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
            >
              {videoLoading ? '处理中...' : '生成视频任务'}
            </button>

            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-white">最近视频任务</h3>
              {videoJobs.length ? (
                videoJobs.map((job) => (
                  <div key={job.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{job.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatStatus(job.status)} · {job.ratio} · {job.durationSeconds || '默认'} 秒 · {job.visualAssetJob?.title || job.scene?.heading || '全片'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreateQualityReview('video', job.id)}
                          disabled={qualityLoading}
                          className="px-3 py-1 text-xs bg-slate-700 text-white rounded disabled:opacity-50"
                        >
                          质检视频
                        </button>
                        <button
                          onClick={() => handleRunVideoJob(job.id)}
                          disabled={videoLoading || hasRunningVideoJobs || job.status === 'running'}
                          className="px-3 py-1 text-xs bg-gray-900 text-white rounded disabled:opacity-50"
                        >
                          {job.status === 'running' ? '运行中' : '执行'}
                        </button>
                      </div>
                    </div>
	                    <details className="mt-2">
	                      <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">查看提示词 / 豆包命令</summary>
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
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  还没有视频任务。选择视觉资产或场景后点击“生成视频任务”，任务会显示在这里。
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {(displayPhase === 'scene_execution' || displayPhase === 'completed') && (
        <section id="quality-reviews" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 scroll-mt-6">
          <h2 className="text-lg font-semibold mb-4">质量校验</h2>
          <div className="mb-5 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">各步骤质检入口</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sceneStates
                .filter((scene) => scene.finalizedScript?.trim())
                .map((scene) => (
                  <button
                    key={`script-${scene.id}`}
                    type="button"
                    onClick={() => handleCreateQualityReview('script', scene.id)}
                    disabled={qualityLoading || batchSceneLoading || isSceneExecuting}
                    className="px-3 py-1.5 text-xs rounded bg-slate-900 text-white disabled:opacity-50"
                  >
                    质检第 {scene.sceneNumber} 场剧本
                  </button>
                ))}
              {visualJobs.map((job) => (
                <button
                  key={`visual-${job.id}`}
                  type="button"
                  onClick={() => handleCreateQualityReview('visual_asset', job.id)}
                  disabled={qualityLoading || job.status === 'running'}
                  className="px-3 py-1.5 text-xs rounded bg-indigo-700 text-white disabled:opacity-50"
                >
                  质检图片：{job.title}
                </button>
              ))}
              {videoJobs.map((job) => (
                <button
                  key={`video-${job.id}`}
                  type="button"
                  onClick={() => handleCreateQualityReview('video', job.id)}
                  disabled={qualityLoading || job.status === 'running'}
                  className="px-3 py-1.5 text-xs rounded bg-rose-700 text-white disabled:opacity-50"
                >
                  质检视频：{job.title}
                </button>
              ))}
              {!sceneStates.some((scene) => scene.finalizedScript?.trim()) && visualJobs.length === 0 && videoJobs.length === 0 && (
                <p className="text-sm text-gray-500">还没有可质检的剧本、图片或视频任务。</p>
              )}
            </div>
          </div>
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
	                          {formatStatus(job.status)} · {formatTargetType(job.targetType)} · {job.passed ? '通过' : '未通过'} · {job.score ?? '-'} 分 · AI 味 {job.aiFeel || '-'} · {job.industryLevel || '-'}
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
