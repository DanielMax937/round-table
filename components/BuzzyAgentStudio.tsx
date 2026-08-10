'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import VideoPromptModeSelector from '@/components/VideoPromptModeSelector';
import {
  getVideoPromptModeLabel,
  type VideoPromptMode,
} from '@/lib/movie/video-prompt-mode-contract';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

interface MovieSummary {
  id: string;
  title: string;
  theme?: string | null;
  createdAt: string;
  _count?: {
    characters?: number;
    scenes?: number;
  };
}

interface StoryProposal {
  oneLiner?: string;
  coreConflict?: string;
  styleReference?: string;
  synopsis?: string;
  [key: string]: unknown;
}

interface Character {
  id: string;
  name: string;
  backstory: string;
  personalityTraits: string;
  surfaceGoal?: string | null;
  deepMotivation?: string | null;
  fatalFlaw?: string | null;
  signatureLanguageStyle?: string | null;
}

interface SceneOutline {
  id: string;
  sortOrder: number;
  title: string;
  contentSummary: string;
  emotionalGoal: string;
  characterIdsJson: string;
}

interface Scene {
  id: string;
  sceneNumber: number;
  heading: string;
  status: string;
  finalizedScript?: string | null;
  sceneOutlineId?: string | null;
}

interface VisualAssetJob {
  id: string;
  status: string;
  assetType: string;
  title: string;
  prompt: string;
  result?: string | null;
  error?: string | null;
  imageUrls?: string[];
  characterId?: string | null;
  sceneId?: string | null;
  createdAt?: string;
  scene?: { heading: string; sceneNumber: number } | null;
  character?: { name: string } | null;
}

interface VideoGenerationJob {
  id: string;
  status: string;
  title: string;
  promptMode?: string;
  ratio: string;
  durationSeconds?: number | null;
  prompt: string;
  outputDir?: string | null;
  result?: string | null;
  error?: string | null;
  visualAssetJobId?: string | null;
  sceneId?: string | null;
  createdAt?: string;
  visualAssetJob?: { title: string; assetType: string } | null;
  scene?: { heading: string; sceneNumber: number } | null;
}

interface Movie {
  id: string;
  title: string;
  description?: string | null;
  theme?: string | null;
  workflowPhase: string;
  storyProposalJson?: string | null;
  storyProposalsJson?: string | null;
  developmentReportJson?: string | null;
  storyBibleJson?: string | null;
  plotSummary?: string | null;
  characters: Character[];
  sceneOutlines: SceneOutline[];
  scenes: Scene[];
  visualAssetJobs: VisualAssetJob[];
  videoGenerationJobs: VideoGenerationJob[];
}

interface SceneExecutionJob {
  id: string;
  status: string;
  sceneId?: string | null;
  outlineIndex: number;
  currentRound?: number | null;
  currentAgentName?: string | null;
  currentPhase?: string | null;
  result?: { sceneId?: string } | null;
  error?: string | null;
}

const storyDirections = [
  { id: 'cinematic', label: 'Cinematic Realism', styles: ['live_action', 'photorealistic'] },
  { id: 'anime', label: 'Anime', styles: ['animation'] },
  { id: 'cyberpunk', label: 'Cyberpunk', styles: ['live_action', 'concept_art'] },
  { id: 'cg', label: '3D Animation', styles: ['cg_animation'] },
] as const;

const ratios = ['16:9', '9:16', '1:1', '4:3', '3:4'];

const durations = [
  { id: 'short', label: '< 30s', value: 20 },
  { id: 'medium', label: '30s - 1min', value: 30 },
  { id: 'long', label: '> 1min', value: 30 },
];

const initialMessages: ChatMessage[] = [
  {
    id: 'initial-assistant',
    role: 'assistant',
    content: '把一句故事创意交给我，我会按“故事脚本 → 角色与场景 → 分镜 → 视频任务”的顺序创建项目资产。',
  },
];

export default function BuzzyAgentStudio({ initialMovieId }: { initialMovieId?: string }) {
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [idea, setIdea] = useState('一个城市里，记忆会以发光物件的形式出现在街道上');
  const [title, setTitle] = useState('');
  const [direction, setDirection] = useState<(typeof storyDirections)[number]['id']>('cinematic');
  const [ratio, setRatio] = useState('16:9');
  const [durationChoice, setDurationChoice] = useState('medium');
  const [selectedProposalIndex, setSelectedProposalIndex] = useState(0);
  const [runImageTasks, setRunImageTasks] = useState(false);
  const [runVideoTasks, setRunVideoTasks] = useState(false);
  const [videoPromptMode, setVideoPromptMode] = useState<VideoPromptMode>('classic');
  const [profileIds, setProfileIds] = useState('1');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [workingLabel, setWorkingLabel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadMovies().catch((err) => setError(errorMessage(err, '加载项目失败')));
  }, []);

  useEffect(() => {
    if (!initialMovieId) return;
    refreshMovie(initialMovieId).catch((err) => setError(errorMessage(err, '载入项目失败')));
  }, [initialMovieId]);

  const selectedDirection = storyDirections.find((item) => item.id === direction) || storyDirections[0];
  const selectedDuration = durations.find((item) => item.id === durationChoice) || durations[1];
  const durationSeconds = selectedDuration.value;
  const storyProposal = useMemo(
    () => parseJson<StoryProposal | null>(movie?.storyProposalJson, null),
    [movie?.storyProposalJson]
  );
  const storyProposals = useMemo(
    () => parseJson<StoryProposal[]>(movie?.storyProposalsJson, []),
    [movie?.storyProposalsJson]
  );

  const latestVisualJobs = movie?.visualAssetJobs || [];
  const latestVideoJobs = movie?.videoGenerationJobs || [];
  const runningVisualJobs = latestVisualJobs.filter((job) => job.status === 'running');
  const runningVideoJobs = latestVideoJobs.filter((job) => job.status === 'running');

  const stageStates = [
    {
      label: 'Set up your Story',
      done: Boolean(movie),
      action: '创建项目',
    },
    {
      label: 'Storyline Script',
      done: Boolean(storyProposal || movie?.storyBibleJson || movie?.sceneOutlines.length),
      action: '生成故事脚本',
    },
    {
      label: 'Characters & Scenes',
      done: Boolean(movie?.characters.length && (movie?.scenes.length || movie?.sceneOutlines.length)),
      action: '生成角色与场景',
    },
    {
      label: 'Director Board',
      done: latestVisualJobs.some((job) => job.assetType === 'storyboard' || job.assetType === 'keyframe'),
      action: '生成分镜',
    },
    {
      label: 'Video Generation',
      done: latestVideoJobs.length > 0,
      action: '生成视频',
    },
  ];

  async function loadMovies() {
    const data = await apiJson<{ movies: MovieSummary[] }>('/api/movies');
    setMovies(data.movies || []);
  }

  async function refreshMovie(movieId = movie?.id) {
    if (!movieId) return null;
    const data = await apiJson<{ movie: Movie }>(`/api/movies/${movieId}`);
    setMovie(data.movie);
    await loadMovies();
    return data.movie;
  }

  async function ensureMovie() {
    if (movie) return movie;
    const trimmedIdea = idea.trim() || chatInput.trim();
    if (!trimmedIdea) {
      throw new Error('请先输入故事创意。');
    }
    setWorkingLabel('创建 Buzzy 风格电影项目');
    const data = await apiJson<{ movie: Movie }>('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim() || `Buzzy Agent：${trimmedIdea.slice(0, 24)}`,
        description: `Buzzy Agent workflow page created from: ${trimmedIdea}`,
        theme: buildTheme(trimmedIdea),
      }),
    });
    addMessage('assistant', `已创建项目：${data.movie.title}`);
    const fullMovie = await refreshMovie(data.movie.id);
    if (!fullMovie) throw new Error('项目创建成功，但读取详情失败。');
    return fullMovie;
  }

  async function ensureStoryReady(quiet = false) {
    let current = await ensureMovie();

    if (!parseJson<StoryProposal[]>(current.storyProposalsJson, []).length) {
      setWorkingLabel('调用 LLM 生成故事提案');
      await apiJson(`/api/movies/${current.id}/story-proposals`, { method: 'POST' });
      current = (await refreshMovie(current.id)) || current;
    }

    if (!current.storyProposalJson) {
      const proposals = parseJson<StoryProposal[]>(current.storyProposalsJson, []);
      const proposalIndex = Math.min(selectedProposalIndex, Math.max(0, proposals.length - 1));
      setWorkingLabel('确认故事方向并进入开发材料');
      await apiJson(`/api/movies/${current.id}/confirm-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalIndex }),
      });
      current = (await refreshMovie(current.id)) || current;
    }

    if (!current.developmentReportJson || !current.storyBibleJson) {
      setWorkingLabel('生成开发读本和故事圣经');
      await apiJson(`/api/movies/${current.id}/development`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      current = (await refreshMovie(current.id)) || current;
    }

    if (!quiet) {
      addMessage('assistant', '故事脚本已经写入 Canvas。你可以继续生成角色、场景和视觉资产。');
    }
    return current;
  }

  async function ensureCharactersAndScenes(options: { quiet?: boolean; createVisualJobs?: boolean } = {}) {
    let current = await ensureStoryReady(true);

    if (!current.characters.length) {
      setWorkingLabel('调用 LLM 生成角色档案');
      await apiJson(`/api/movies/${current.id}/characters/generate`, { method: 'POST' });
      current = (await refreshMovie(current.id)) || current;
    }

    if (!current.sceneOutlines.length) {
      setWorkingLabel('生成场景大纲');
      await apiJson(`/api/movies/${current.id}/outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useFourPartStructure: false }),
      });
      current = (await refreshMovie(current.id)) || current;
    }

    current = await executeMissingScenes(current, 2);

    if (options.createVisualJobs !== false) {
      const sceneIds = current.scenes.slice(0, 2).map((scene) => scene.id);
      const assetTypes = sceneIds.length ? ['character_look', 'environment'] : ['character_look'];
      setWorkingLabel(runImageTasks ? '创建并执行角色/场景图片任务' : '创建角色/场景图片任务');
      await apiJson(`/api/movies/${current.id}/visual-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetTypes,
          styles: selectedDirection.styles,
          sceneIds,
          characterIds: current.characters.map((character) => character.id),
          notes: buildProductionNotes('character-scene'),
          run: runImageTasks,
        }),
      });
      current = (await refreshMovie(current.id)) || current;
    }

    if (!options.quiet) {
      addMessage(
        'assistant',
        runImageTasks
          ? '角色和场景任务已创建，图片队列正在执行。'
          : '角色和场景已进入 Canvas，图片任务已创建，可在节点上单独执行。'
      );
    }

    return current;
  }

  async function executeMissingScenes(current: Movie, limit: number) {
    const existingOutlineIds = new Set(current.scenes.map((scene) => scene.sceneOutlineId).filter(Boolean));
    const missingTargets = current.sceneOutlines
      .map((outline, index) => ({ outline, index }))
      .filter(({ outline }) => !existingOutlineIds.has(outline.id))
      .slice(0, limit);

    let next = current;
    for (const target of missingTargets) {
      setWorkingLabel(`生成场景剧本：${target.outline.title}`);
      const response = await fetch(`/api/movies/${current.id}/scenes/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlineIndex: target.index }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (typeof data.sceneId === 'string') continue;
        throw new Error(data.details || data.error || '启动场景生成失败');
      }
      if (!data.jobId) continue;
      const job = await pollSceneJob(current.id, data.jobId, target.outline.title);
      const sceneId = job.sceneId || job.result?.sceneId;
      if (sceneId) {
        setWorkingLabel(`确认场景剧本：${target.outline.title}`);
        await apiJson(`/api/movies/${current.id}/scenes/${sceneId}/settle`, { method: 'POST' });
      }
      next = (await refreshMovie(current.id)) || next;
    }
    return next;
  }

  async function pollSceneJob(movieId: string, jobId: string, titleText: string) {
    const startedAt = Date.now();
    const timeoutMs = 30 * 60 * 1000;

    while (Date.now() - startedAt < timeoutMs) {
      const data = await apiJson<{ job: SceneExecutionJob }>(
        `/api/movies/${movieId}/scenes/execute?jobId=${jobId}`,
        { cache: 'no-store' }
      );
      const detail = [data.job.currentPhase, data.job.currentAgentName].filter(Boolean).join(' · ');
      setWorkingLabel(`生成场景剧本：${titleText}${detail ? ` · ${detail}` : ''}`);
      if (data.job.status === 'completed') return data.job;
      if (data.job.status === 'failed') {
        throw new Error(data.job.error || '场景生成失败');
      }
      await wait(2500);
    }

    throw new Error(`场景生成超时：${titleText}`);
  }

  async function handleGenerateStoryScript() {
    await runAction(async () => {
      await ensureStoryReady(false);
    });
  }

  async function handleGenerateCharactersAndScenes() {
    await runAction(async () => {
      await ensureCharactersAndScenes({ createVisualJobs: true });
    });
  }

  async function handleGenerateStoryboard() {
    await runAction(async () => {
      let current = await ensureCharactersAndScenes({ quiet: true, createVisualJobs: false });
      current = await executeMissingScenes(current, 1);
      const sceneIds = current.scenes.slice(0, 3).map((scene) => scene.id);
      if (!sceneIds.length) {
        throw new Error('还没有可用于分镜的场景剧本。');
      }
      setWorkingLabel(runImageTasks ? '创建并执行分镜/关键帧任务' : '创建分镜/关键帧任务');
      await apiJson(`/api/movies/${current.id}/visual-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetTypes: ['keyframe', 'storyboard'],
          styles: selectedDirection.styles,
          sceneIds,
          notes: buildProductionNotes('storyboard'),
          run: runImageTasks,
        }),
      });
      await refreshMovie(current.id);
      addMessage(
        'assistant',
        runImageTasks
          ? '分镜和关键帧任务已创建，图片队列正在执行。'
          : '分镜和关键帧任务已创建。Canvas 中可以逐个执行或等待外部队列处理。'
      );
    });
  }

  async function handleGenerateVideo() {
    await runAction(async () => {
      let current = await ensureCharactersAndScenes({ quiet: true, createVisualJobs: false });
      const visualTargets = current.visualAssetJobs
        .filter((job) => job.assetType === 'keyframe' || job.assetType === 'storyboard')
        .slice(0, 3);
      const completedVisualTargets = visualTargets.filter((job) => job.status === 'completed');
      const visualAssetJobIds = (completedVisualTargets.length ? completedVisualTargets : visualTargets).map(
        (job) => job.id
      );
      const sceneIds = visualAssetJobIds.length ? [] : current.scenes.slice(0, 1).map((scene) => scene.id);

      if (!visualAssetJobIds.length && !sceneIds.length) {
        throw new Error('还没有可用于视频生成的分镜、关键帧或场景。');
      }

      setWorkingLabel(runVideoTasks ? '创建并执行视频生成任务' : '创建视频生成任务');
      await apiJson(`/api/movies/${current.id}/video-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptMode: videoPromptMode,
          visualAssetJobIds,
          sceneIds,
          ratio,
          durationSeconds,
          profileIds,
          notes: buildProductionNotes('video'),
          run: runVideoTasks,
        }),
      });
      current = (await refreshMovie(current.id)) || current;
      addMessage(
        'assistant',
        runVideoTasks
          ? '视频任务已创建并进入执行队列。'
          : '视频任务已创建。你可以在 Canvas 的视频节点上查看提示词和执行命令。'
      );
    });
  }

  async function handleRunVisualJob(jobId: string) {
    await runAction(async () => {
      if (!movie) return;
      setWorkingLabel('执行图片生成任务');
      await apiJson(`/api/movies/${movie.id}/visual-assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      await refreshMovie(movie.id);
      addMessage('assistant', '图片生成任务已开始执行。');
    });
  }

  async function handleRunVideoJob(jobId: string) {
    await runAction(async () => {
      if (!movie) return;
      setWorkingLabel('执行视频生成任务');
      await apiJson(`/api/movies/${movie.id}/video-assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, profileIds }),
      });
      await refreshMovie(movie.id);
      addMessage('assistant', '视频生成任务已开始执行。');
    });
  }

  async function handleSelectMovie(movieId: string) {
    await runAction(async () => {
      if (!movieId) {
        setMovie(null);
        return;
      }
      setWorkingLabel('载入项目');
      const selected = await refreshMovie(movieId);
      if (selected) addMessage('assistant', `已载入项目：${selected.title}`);
    });
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    addMessage('user', text);
    setChatInput('');

    if (!movie) {
      setIdea(text);
      addMessage('assistant', '我会把这句话作为新项目创意。设置好风格和画幅后，可以直接生成故事脚本。');
      return;
    }

    if (/视频|video/i.test(text)) {
      await handleGenerateVideo();
      return;
    }
    if (/分镜|storyboard|director/i.test(text)) {
      await handleGenerateStoryboard();
      return;
    }
    if (/角色|场景|character|scene/i.test(text)) {
      await handleGenerateCharactersAndScenes();
      return;
    }
    if (/故事|剧本|script|story/i.test(text)) {
      await handleGenerateStoryScript();
      return;
    }

    addMessage('assistant', '收到。我会把这条补充放进后续生成备注里；当前页面的四个主动作仍会复用项目底层流水线。');
  }

  async function runAction(action: () => Promise<void>) {
    setLoading(true);
    setError('');
    try {
      await action();
    } catch (err) {
      const message = errorMessage(err, '操作失败');
      setError(message);
      addMessage('assistant', message);
    } finally {
      setLoading(false);
      setWorkingLabel('');
    }
  }

  function addMessage(role: Role, content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        content,
      },
    ]);
  }

  function buildTheme(prompt: string) {
    return [
      prompt,
      '',
      'Buzzy Agent flow requirements:',
      `Story direction: ${selectedDirection.label}`,
      `Aspect ratio: ${ratio}`,
      `Target duration: ${durationSeconds} seconds`,
      'Produce a compact video story with clear visual hooks, reusable character references, concrete locations, storyboardable action beats, and image-to-video continuity anchors.',
    ].join('\n');
  }

  function buildProductionNotes(stage: 'character-scene' | 'storyboard' | 'video') {
    const stageNotes: Record<typeof stage, string> = {
      'character-scene':
        'Buzzy-style canvas step: create inspectable character look boards and scene/environment boards. Preserve identity, wardrobe, location geography, lighting continuity, and one clear story prop.',
      storyboard:
        'Buzzy-style director board step: create storyboard/keyframe assets with exact panel order, shot sizes, time beats, camera movement, and continuity from the generated script.',
      video:
        'Buzzy-style video step: turn the generated storyboard/keyframe into a short coherent clip. Preserve characters, scene geography, practical light source, and emotional beat continuity.',
    };
    return [
      stageNotes[stage],
      `Selected direction: ${selectedDirection.label}.`,
      `Target ratio: ${ratio}. Target duration: ${durationSeconds}s.`,
      idea.trim() ? `Original user idea: ${idea.trim()}` : '',
    ].filter(Boolean).join('\n');
  }

  const characters = movie?.characters || [];
  const outlines = movie?.sceneOutlines || [];
  const scenes = movie?.scenes || [];
  const characterAssets = latestVisualJobs.filter((job) => job.assetType === 'character_look');
  const environmentAssets = latestVisualJobs.filter((job) => job.assetType === 'environment');
  const storyboardAssets = latestVisualJobs.filter((job) => job.assetType === 'storyboard' || job.assetType === 'keyframe');
  const firstProposal = storyProposal || storyProposals[selectedProposalIndex] || storyProposals[0] || null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100">
      <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:h-[calc(100vh-4rem)] lg:flex-row">
        <aside className="flex min-h-0 w-full flex-col border-b border-neutral-800 bg-neutral-900 lg:h-full lg:w-[390px] lg:border-b-0 lg:border-r">
          <div className="border-b border-neutral-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-yellow-300">Buzzy Agent Flow</p>
                <h1 className="mt-1 text-xl font-semibold text-white">视频故事工作台</h1>
              </div>
              <Link
                href="/movies"
                className="shrink-0 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
              >
                项目
              </Link>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <section className="space-y-3">
              <label className="block text-sm font-medium text-neutral-300" htmlFor="project-select">
                继续已有项目
              </label>
              <select
                id="project-select"
                value={movie?.id || ''}
                onChange={(event) => handleSelectMovie(event.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-yellow-300"
                disabled={loading}
              >
                <option value="">新建 Buzzy Agent 项目</option>
                {movies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </section>

            <section className="space-y-3">
              <label className="block text-sm font-medium text-neutral-300" htmlFor="story-idea">
                故事创意
              </label>
              <textarea
                id="story-idea"
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                rows={4}
                className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-yellow-300"
                placeholder="例如：一个城市里，记忆会以发光物件的形式出现"
                disabled={Boolean(movie) || loading}
              />
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-yellow-300"
                placeholder="项目标题，可选"
                disabled={Boolean(movie) || loading}
              />
            </section>

            <section className="space-y-3">
              <p className="text-sm font-medium text-neutral-300">Story Direction</p>
              <div className="grid grid-cols-2 gap-2">
                {storyDirections.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDirection(item.id)}
                    className={`min-h-10 rounded-md border px-3 py-2 text-sm transition-colors ${
                      direction === item.id
                        ? 'border-yellow-300 bg-yellow-300 text-neutral-950'
                        : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:bg-neutral-800'
                    }`}
                    disabled={loading}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-sm font-medium text-neutral-300">Aspect Ratio</p>
              <div className="grid grid-cols-5 gap-2">
                {ratios.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRatio(item)}
                    className={`min-h-9 rounded-md border px-2 py-1 text-sm ${
                      ratio === item
                        ? 'border-yellow-300 bg-yellow-300 text-neutral-950'
                        : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:bg-neutral-800'
                    }`}
                    disabled={loading}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-sm font-medium text-neutral-300">Duration</p>
              <div className="grid grid-cols-3 gap-2">
                {durations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDurationChoice(item.id)}
                    className={`min-h-10 rounded-md border px-2 py-1 text-sm ${
                      durationChoice === item.id
                        ? 'border-yellow-300 bg-yellow-300 text-neutral-950'
                        : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:bg-neutral-800'
                    }`}
                    disabled={loading}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-sm font-medium text-neutral-300">Agent Controls</p>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Video prompt mode
                </p>
                <VideoPromptModeSelector
                  value={videoPromptMode}
                  onChange={setVideoPromptMode}
                  disabled={loading}
                  variant="studio"
                />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
                <span>自动执行图片生成</span>
                <input
                  type="checkbox"
                  checked={runImageTasks}
                  onChange={(event) => setRunImageTasks(event.target.checked)}
                  disabled={loading}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
                <span>自动执行视频生成</span>
                <input
                  type="checkbox"
                  checked={runVideoTasks}
                  onChange={(event) => setRunVideoTasks(event.target.checked)}
                  disabled={loading}
                />
              </label>
              <input
                value={profileIds}
                onChange={(event) => setProfileIds(event.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-yellow-300"
                placeholder="视频 profileIds"
                disabled={loading}
              />
            </section>

            <section className="space-y-2">
              {stageStates.map((stage, index) => (
                <div
                  key={stage.label}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-100">{stage.label}</p>
                    <p className="text-xs text-neutral-500">{stage.action}</p>
                  </div>
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                      stage.done ? 'bg-yellow-300 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {stage.done ? '✓' : index + 1}
                  </span>
                </div>
              ))}
            </section>

            {storyProposals.length > 1 && !storyProposal && (
              <section className="space-y-2">
                <p className="text-sm font-medium text-neutral-300">故事方向候选</p>
                {storyProposals.map((proposal, index) => (
                  <button
                    key={`${proposal.oneLiner || 'proposal'}-${index}`}
                    type="button"
                    onClick={() => setSelectedProposalIndex(index)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selectedProposalIndex === index
                        ? 'border-yellow-300 bg-yellow-300 text-neutral-950'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-200'
                    }`}
                    disabled={loading}
                  >
                    {proposal.oneLiner || `候选 ${index + 1}`}
                  </button>
                ))}
              </section>
            )}
          </div>

          <div className="mt-auto border-t border-neutral-800 p-4">
            <div className="mb-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-md px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'ml-8 bg-yellow-300 text-neutral-950'
                      : 'mr-8 bg-neutral-800 text-neutral-100'
                  }`}
                >
                  {message.content}
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-yellow-300"
                placeholder="Ask Buzzy to generate or edit..."
                disabled={loading}
              />
              <button
                type="submit"
                className="h-10 w-10 rounded-md bg-yellow-300 text-lg font-semibold text-neutral-950 hover:bg-yellow-200 disabled:opacity-50"
                disabled={loading || !chatInput.trim()}
                aria-label="发送"
                title="发送"
              >
                ↑
              </button>
            </form>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto lg:h-full">
          <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/95 p-4 backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-neutral-500">{movie ? movie.id : 'new-agent-session'}</p>
                <h2 className="truncate text-2xl font-semibold text-white">
                  {movie?.title || 'Untitled Buzzy Agent Canvas'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleGenerateStoryScript}
                  className="rounded-md bg-yellow-300 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-yellow-200 disabled:opacity-50"
                  disabled={loading}
                >
                  Generate script
                </button>
                <button
                  type="button"
                  onClick={handleGenerateCharactersAndScenes}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
                  disabled={loading}
                >
                  Characters & scenes
                </button>
                <button
                  type="button"
                  onClick={handleGenerateStoryboard}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
                  disabled={loading}
                >
                  Storyboard
                </button>
                <button
                  type="button"
                  onClick={handleGenerateVideo}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
                  disabled={loading}
                >
                  Video
                </button>
                {movie && (
                  <Link
                    href={`/movies/${movie.id}/workflow`}
                    className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
                  >
                    传统产制
                  </Link>
                )}
              </div>
            </div>
            {(loading || error || runningVisualJobs.length > 0 || runningVideoJobs.length > 0) && (
              <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
                {loading && <span className="text-yellow-200">{workingLabel || 'Agent 正在处理...'}</span>}
                {!loading && runningVisualJobs.length > 0 && (
                  <span className="text-yellow-200">有 {runningVisualJobs.length} 个图片任务运行中。</span>
                )}
                {!loading && runningVideoJobs.length > 0 && (
                  <span className="text-yellow-200">有 {runningVideoJobs.length} 个视频任务运行中。</span>
                )}
                {error && <span className="block text-red-300">{error}</span>}
              </div>
            )}
          </div>

          <div className="bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.14)_1px,transparent_0)] bg-[length:24px_24px] p-4 lg:p-6">
            <div className="grid auto-rows-min gap-4 xl:grid-cols-[minmax(320px,1.1fr)_minmax(300px,0.9fr)]">
              <StoryNode movie={movie} proposal={firstProposal} outlines={outlines} />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                {characters.length ? (
                  characters.map((character) => (
                    <CharacterNode
                      key={character.id}
                      character={character}
                      asset={findCharacterAsset(characterAssets, character.id)}
                      onRunVisualJob={handleRunVisualJob}
                      disabled={loading}
                    />
                  ))
                ) : (
                  <EmptyNode title="Character 1" body="角色定妆照会在生成角色后出现在这里。" />
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {scenes.length || outlines.length ? (
                  (scenes.length ? scenes : outlines).slice(0, 3).map((item) => {
                    const scene = 'sceneNumber' in item ? item : null;
                    const outline = 'sortOrder' in item ? item : null;
                    return (
                      <SceneNode
                        key={item.id}
                        title={scene ? `Scene ${scene.sceneNumber} - ${scene.heading}` : `Scene ${outline!.sortOrder + 1} - ${outline!.title}`}
                        summary={scene?.finalizedScript || outline?.contentSummary || ''}
                        status={scene?.status || 'outline'}
                        asset={scene ? findSceneAsset(environmentAssets, scene.id) : environmentAssets[0]}
                        onRunVisualJob={handleRunVisualJob}
                        disabled={loading}
                      />
                    );
                  })
                ) : (
                  <>
                    <EmptyNode title="Scene 1" body="场景大纲、剧本和环境设定图会显示在这里。" />
                    <EmptyNode title="Scene 2" body="Buzzy 风格 Canvas 会把场景节点连接到分镜和视频任务。" />
                  </>
                )}
              </div>

              <DirectorBoardNode
                assets={storyboardAssets}
                onRunVisualJob={handleRunVisualJob}
                disabled={loading}
              />

              <VideoNode
                jobs={latestVideoJobs}
                onRunVideoJob={handleRunVideoJob}
                disabled={loading}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StoryNode({
  movie,
  proposal,
  outlines,
}: {
  movie: Movie | null;
  proposal: StoryProposal | null;
  outlines: SceneOutline[];
}) {
  return (
    <article className="rounded-md border border-neutral-700 bg-neutral-900/95 p-4 shadow-xl shadow-black/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase text-neutral-500">Storyline Script</p>
          <h3 className="truncate text-lg font-semibold text-white">{movie?.title || 'City of Glowing Memories'}</h3>
        </div>
        <StatusPill status={proposal ? 'completed' : 'pending'} />
      </div>

      <section className="mb-4">
        <h4 className="mb-1 text-sm font-semibold text-yellow-200">Main Story</h4>
        <p className="text-sm leading-6 text-neutral-300">
          {proposal?.synopsis ||
            proposal?.oneLiner ||
            '故事脚本生成后，这里会展示主故事、核心冲突和影片风格。'}
        </p>
      </section>

      {proposal?.coreConflict && (
        <section className="mb-4">
          <h4 className="mb-1 text-sm font-semibold text-yellow-200">Core Conflict</h4>
          <p className="text-sm leading-6 text-neutral-300">{proposal.coreConflict}</p>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-sm font-semibold text-yellow-200">Outline</h4>
        <div className="space-y-2">
          {outlines.length ? (
            outlines.map((outline) => (
              <div key={outline.id} className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
                <p className="text-sm font-medium text-neutral-100">
                  Chapter {outline.sortOrder + 1} - {outline.title}
                </p>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-neutral-400">{outline.contentSummary}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-500">生成故事脚本后会自动拆出章节和场景。</p>
          )}
        </div>
      </section>
    </article>
  );
}

function CharacterNode({
  character,
  asset,
  onRunVisualJob,
  disabled,
}: {
  character: Character;
  asset?: VisualAssetJob;
  onRunVisualJob: (jobId: string) => void;
  disabled: boolean;
}) {
  return (
    <article className="rounded-md border border-neutral-700 bg-neutral-900/95 p-4 shadow-xl shadow-black/20">
      <NodeHeader title={`Character - ${character.name}`} status={asset?.status || 'profile'} />
      <AssetImage asset={asset} fallback="角色定妆图待生成" />
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-300">{character.backstory}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">{character.personalityTraits}</p>
      {asset && asset.status !== 'running' && asset.status !== 'completed' && (
        <button
          type="button"
          onClick={() => onRunVisualJob(asset.id)}
          className="mt-3 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
          disabled={disabled}
        >
          Run image job
        </button>
      )}
    </article>
  );
}

function SceneNode({
  title,
  summary,
  status,
  asset,
  onRunVisualJob,
  disabled,
}: {
  title: string;
  summary: string;
  status: string;
  asset?: VisualAssetJob;
  onRunVisualJob: (jobId: string) => void;
  disabled: boolean;
}) {
  return (
    <article className="rounded-md border border-neutral-700 bg-neutral-900/95 p-4 shadow-xl shadow-black/20">
      <NodeHeader title={title} status={asset?.status || status} />
      <AssetImage asset={asset} fallback="场景设定图待生成" />
      <p className="mt-3 line-clamp-5 text-sm leading-6 text-neutral-300">{summary}</p>
      {asset && asset.status !== 'running' && asset.status !== 'completed' && (
        <button
          type="button"
          onClick={() => onRunVisualJob(asset.id)}
          className="mt-3 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
          disabled={disabled}
        >
          Run image job
        </button>
      )}
    </article>
  );
}

function DirectorBoardNode({
  assets,
  onRunVisualJob,
  disabled,
}: {
  assets: VisualAssetJob[];
  onRunVisualJob: (jobId: string) => void;
  disabled: boolean;
}) {
  const primaryAsset = assets.find((asset) => asset.imageUrls?.length) || assets[0];

  return (
    <article className="rounded-md border border-neutral-700 bg-neutral-900/95 p-4 shadow-xl shadow-black/20 xl:row-span-2">
      <NodeHeader title="Director Board Full" status={primaryAsset?.status || 'pending'} />
      {primaryAsset ? (
        <>
          <AssetImage asset={primaryAsset} fallback="分镜图片任务已创建，等待执行或生成结果" tall />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {assets.slice(0, 6).map((asset) => (
              <div key={asset.id} className="rounded-md border border-neutral-800 bg-neutral-950 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-medium text-neutral-200">{asset.title}</p>
                  <StatusPill status={asset.status} />
                </div>
                {asset.status !== 'running' && asset.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => onRunVisualJob(asset.id)}
                    className="mt-2 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
                    disabled={disabled}
                  >
                    Run
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid min-h-[360px] place-items-center rounded-md border border-dashed border-neutral-700 bg-neutral-950 p-6 text-center text-sm text-neutral-500">
          分镜、关键帧和导演板会在这里汇总。
        </div>
      )}
    </article>
  );
}

function VideoNode({
  jobs,
  onRunVideoJob,
  disabled,
}: {
  jobs: VideoGenerationJob[];
  onRunVideoJob: (jobId: string) => void;
  disabled: boolean;
}) {
  const latestJob = jobs[0];

  return (
    <article className="rounded-md border border-neutral-700 bg-neutral-900/95 p-4 shadow-xl shadow-black/20">
      <NodeHeader title="Generated Video" status={latestJob?.status || 'pending'} />
      {latestJob ? (
        <div className="space-y-3">
          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
            <p className="text-sm font-medium text-neutral-100">{latestJob.title}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {getVideoPromptModeLabel(latestJob.promptMode)} · {latestJob.ratio} · {latestJob.durationSeconds || '-'}s
            </p>
            <p className="mt-3 line-clamp-6 text-xs leading-5 text-neutral-400">{latestJob.prompt}</p>
            {latestJob.outputDir && (
              <p className="mt-3 break-all text-xs text-neutral-500">Output: {latestJob.outputDir}</p>
            )}
            {latestJob.error && <p className="mt-3 text-xs text-red-300">{latestJob.error}</p>}
          </div>
          {jobs.slice(0, 5).map((job) => (
            <div key={job.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
              <p className="min-w-0 truncate text-xs text-neutral-300">{job.title}</p>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill status={job.status} />
                {job.status !== 'running' && job.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => onRunVideoJob(job.id)}
                    className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
                    disabled={disabled}
                  >
                    Run
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-h-[220px] place-items-center rounded-md border border-dashed border-neutral-700 bg-neutral-950 p-6 text-center text-sm text-neutral-500">
          视频生成任务会引用分镜、关键帧或场景脚本。
        </div>
      )}
    </article>
  );
}

function EmptyNode({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-md border border-dashed border-neutral-700 bg-neutral-900/70 p-4">
      <NodeHeader title={title} status="pending" />
      <div className="mt-3 grid min-h-[180px] place-items-center rounded-md bg-neutral-950 p-5 text-center text-sm text-neutral-500">
        {body}
      </div>
    </article>
  );
}

function NodeHeader({ title, status }: { title: string; status: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="min-w-0 truncate text-base font-semibold text-white">{title}</h3>
      <StatusPill status={status} />
    </div>
  );
}

function AssetImage({
  asset,
  fallback,
  tall = false,
}: {
  asset?: VisualAssetJob;
  fallback: string;
  tall?: boolean;
}) {
  const imageUrl = asset?.imageUrls?.[0];
  if (!imageUrl) {
    return (
      <div
        className={`grid place-items-center rounded-md border border-dashed border-neutral-700 bg-neutral-950 p-5 text-center text-sm text-neutral-500 ${
          tall ? 'min-h-[360px]' : 'min-h-[220px]'
        }`}
      >
        {fallback}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-md border border-neutral-800 bg-neutral-950 ${tall ? 'min-h-[360px]' : ''}`}>
      <img src={imageUrl} alt={asset?.title || 'visual asset'} className="h-full max-h-[620px] w-full object-cover" />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status || 'pending';
  const className = statusClass(normalized);
  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${className}`}>
      {statusLabel(normalized)}
    </span>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '待处理',
    profile: '档案',
    outline: '大纲',
    running: '运行中',
    completed: '完成',
    failed: '失败',
    confirmed: '已确认',
    finalized: '已定稿',
  };
  return labels[status] || status;
}

function statusClass(status: string) {
  if (status === 'completed' || status === 'confirmed' || status === 'finalized') {
    return 'bg-emerald-400/15 text-emerald-200';
  }
  if (status === 'running') return 'bg-yellow-300/15 text-yellow-200';
  if (status === 'failed') return 'bg-red-400/15 text-red-200';
  return 'bg-neutral-700 text-neutral-300';
}

function findCharacterAsset(assets: VisualAssetJob[], characterId: string) {
  return assets.find((asset) => asset.characterId === characterId && asset.imageUrls?.length)
    || assets.find((asset) => asset.characterId === characterId)
    || assets[0];
}

function findSceneAsset(assets: VisualAssetJob[], sceneId: string) {
  return assets.find((asset) => asset.sceneId === sceneId && asset.imageUrls?.length)
    || assets.find((asset) => asset.sceneId === sceneId)
    || assets[0];
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.details || data.error || `请求失败：${response.status}`);
  }
  return data as T;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
