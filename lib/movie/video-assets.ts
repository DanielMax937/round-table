import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '@/lib/prisma';
import { chatCompletion } from '@/lib/llm/client';

const DOUBAO_TASK_ROOT =
  process.env.DOUBAO_VIDEO_TASK_ROOT || '/Users/daniel/Desktop/gy/website-scraper';
const DOUBAO_OUTPUT_ROOT =
  process.env.DOUBAO_VIDEO_OUTPUT_ROOT || path.join(process.cwd(), 'outputs', 'doubao-video');
const DOUBAO_INPUT_ROOT =
  process.env.DOUBAO_VIDEO_INPUT_ROOT || path.join(process.cwd(), 'outputs', 'doubao-video-inputs');

export interface VideoGenerationRequest {
  visualAssetJobIds?: string[];
  sceneIds?: string[];
  sourceImagePaths?: string[];
  ratio?: string;
  durationSeconds?: number;
  profileIds?: string;
  notes?: string;
  run?: boolean;
}

interface MovieForVideo {
  id: string;
  title: string;
  theme?: string | null;
  description?: string | null;
  plotSummary?: string | null;
  storyProposalJson?: string | null;
  characters: Array<{
    id: string;
    name: string;
    backstory: string;
    personalityTraits: string;
    surfaceGoal?: string | null;
    deepMotivation?: string | null;
  }>;
  scenes: Array<{
    id: string;
    sceneNumber: number;
    heading: string;
    description: string;
    contentSummary?: string | null;
    emotionalGoal?: string | null;
    finalizedScript?: string | null;
    sceneCharacters: Array<{ character: { id: string; name: string } }>;
  }>;
  visualAssetJobs: Array<{
    id: string;
    status: string;
    assetType: string;
    title: string;
    prompt: string;
    result?: string | null;
    sceneId?: string | null;
    characterId?: string | null;
    scene?: { id: string; sceneNumber: number; heading: string; description: string; contentSummary?: string | null; emotionalGoal?: string | null; finalizedScript?: string | null } | null;
    character?: { id: string; name: string; backstory: string; personalityTraits: string } | null;
  }>;
}

export function normalizeVideoGenerationRequest(input: Partial<VideoGenerationRequest>): VideoGenerationRequest {
  return {
    visualAssetJobIds: normalizeList(input.visualAssetJobIds, []),
    sceneIds: normalizeList(input.sceneIds, []),
    sourceImagePaths: normalizeList(input.sourceImagePaths, []).map((item) => item.trim()).filter(Boolean),
    ratio: normalizeRatio(input.ratio),
    durationSeconds: normalizeDuration(input.durationSeconds),
    profileIds: typeof input.profileIds === 'string' && input.profileIds.trim() ? input.profileIds.trim() : '1',
    notes: typeof input.notes === 'string' ? input.notes.trim() : '',
    run: Boolean(input.run),
  };
}

export async function createVideoGenerationJobs(movieId: string, request: VideoGenerationRequest) {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    include: {
      characters: { orderBy: { createdAt: 'asc' } },
      scenes: {
        orderBy: { sceneNumber: 'asc' },
        include: {
          sceneCharacters: {
            orderBy: { order: 'asc' },
            include: { character: true },
          },
        },
      },
      visualAssetJobs: {
        orderBy: { createdAt: 'desc' },
        include: {
          scene: true,
          character: true,
        },
      },
    },
  });

  if (!movie) {
    throw new Error('Movie not found');
  }

  const specs = await buildVideoSpecs(movie, request);
  if (!specs.length) {
    throw new Error('No video targets found. Select visual assets or scenes first.');
  }

  const jobs = [];
  for (const spec of specs) {
    const id = randomUUID();
    const inputJsonPath = path.join(DOUBAO_INPUT_ROOT, `${id}.json`);
    const outputDir = path.join(DOUBAO_OUTPUT_ROOT, id);
    const doubaoCommand = buildDoubaoCommand(inputJsonPath, outputDir, request.profileIds || '1');
    const doubaoInputJson = JSON.stringify([
      {
        prompt: spec.prompt,
        imagePaths: spec.sourceImagePaths,
        ratio: request.ratio || '16:9',
      },
    ], null, 2);
    fs.mkdirSync(path.dirname(inputJsonPath), { recursive: true });
    fs.writeFileSync(inputJsonPath, doubaoInputJson, 'utf8');
    const job = await prisma.videoGenerationJob.create({
      data: {
        id,
        movieId: movie.id,
        sceneId: spec.sceneId,
        visualAssetJobId: spec.visualAssetJobId,
        title: spec.title,
        ratio: request.ratio || '16:9',
        durationSeconds: request.durationSeconds,
        sourceImagePathsJson: JSON.stringify(spec.sourceImagePaths),
        prompt: spec.prompt,
        doubaoInputJson,
        inputJsonPath,
        doubaoCommand,
        outputDir,
      },
    });
    jobs.push(job);

    if (request.run) {
      executeVideoGenerationJob(job.id, request.profileIds || '1').catch((error) => {
        console.error(`[VideoGenerationJob] ${job.id} failed`, error);
      });
    }
  }

  return jobs;
}

export async function executeVideoGenerationJob(jobId: string, profileIds = '1'): Promise<void> {
  const job = await prisma.videoGenerationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error(`Video generation job ${jobId} not found`);
  }

  const inputJsonPath = job.inputJsonPath || path.join(DOUBAO_INPUT_ROOT, `${job.id}.json`);
  const outputDir = job.outputDir || path.join(DOUBAO_OUTPUT_ROOT, job.id);
  fs.mkdirSync(path.dirname(inputJsonPath), { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(inputJsonPath, job.doubaoInputJson, 'utf8');

  const executionCommand = buildDoubaoCommand(inputJsonPath, outputDir, profileIds);
  await prisma.videoGenerationJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: new Date(),
      error: null,
      inputJsonPath,
      outputDir,
      executionCommand,
    },
  });

  try {
    const result = await runDoubaoVideoCommand(inputJsonPath, outputDir, profileIds);
    await prisma.videoGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        result: result.slice(-12000),
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.videoGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message.slice(0, 4000) : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function buildVideoSpecs(movie: MovieForVideo, request: VideoGenerationRequest) {
  const selectedVisualIds = new Set(request.visualAssetJobIds || []);
  const selectedSceneIds = new Set(request.sceneIds || []);
  const visualTargets = movie.visualAssetJobs.filter((job) =>
    selectedVisualIds.size > 0 ? selectedVisualIds.has(job.id) : false
  );
  const sceneTargets = movie.scenes.filter((scene) =>
    selectedSceneIds.size > 0 ? selectedSceneIds.has(scene.id) : false
  );

  const specs: Array<{
    visualAssetJobId?: string;
    sceneId?: string;
    title: string;
    sourceImagePaths: string[];
    prompt: string;
  }> = [];

  for (const visual of visualTargets) {
    const scene = visual.sceneId ? movie.scenes.find((item) => item.id === visual.sceneId) || visual.scene : visual.scene;
    const sourceImagePaths = resolveImagePaths(request.sourceImagePaths || [], visual.result || '');
    specs.push({
      visualAssetJobId: visual.id,
      sceneId: visual.sceneId || undefined,
      title: `${visual.title} 视频`,
      sourceImagePaths,
      prompt: await generateVideoPromptWithLLM(movie, {
        visualTitle: visual.title,
        visualType: visual.assetType,
        visualPrompt: visual.prompt,
        visualResult: visual.result || '',
        scene,
        character: visual.character || undefined,
        durationSeconds: request.durationSeconds,
        notes: request.notes,
      }),
    });
  }

  for (const scene of sceneTargets) {
    specs.push({
      sceneId: scene.id,
      title: `Scene ${scene.sceneNumber}: ${scene.heading} 视频`,
      sourceImagePaths: request.sourceImagePaths || [],
      prompt: await generateVideoPromptWithLLM(movie, {
        visualTitle: `Scene ${scene.sceneNumber}: ${scene.heading}`,
        visualType: 'scene_video',
        visualPrompt: '',
        visualResult: '',
        scene,
        durationSeconds: request.durationSeconds,
        notes: request.notes,
      }),
    });
  }

  return specs;
}

async function generateVideoPromptWithLLM(
  movie: MovieForVideo,
  context: {
    visualTitle: string;
    visualType: string;
    visualPrompt: string;
    visualResult: string;
    scene?: MovieForVideo['scenes'][number] | MovieForVideo['visualAssetJobs'][number]['scene'] | null;
    character?: MovieForVideo['visualAssetJobs'][number]['character'];
    durationSeconds?: number;
    notes?: string;
  }
): Promise<string> {
  const scene = context.scene;
  const characters = scene && 'sceneCharacters' in scene
    ? scene.sceneCharacters.map((item) => item.character.name).join(', ')
    : context.character?.name || movie.characters.map((item) => item.name).join(', ');
  const story = truncate(parseStoryProposal(movie.storyProposalJson) || movie.plotSummary || movie.description || '', 420);
  const durationText = context.durationSeconds ? `${context.durationSeconds} seconds` : '8-12 seconds';
  const sceneText = scene
    ? [
        `Scene: ${scene.heading}`,
        `Scene summary: ${scene.contentSummary || scene.description}`,
        scene.emotionalGoal ? `Emotional goal: ${scene.emotionalGoal}` : '',
        scene.finalizedScript ? `Approved screenplay excerpt: ${truncate(scene.finalizedScript, 1200)}` : '',
      ].filter(Boolean).join('\n')
    : '';
  const visualContext = [
    context.visualPrompt ? `Reference image design prompt: ${truncate(context.visualPrompt, 1200)}` : '',
    context.visualResult ? `Generated image notes / result: ${truncate(context.visualResult, 900)}` : '',
  ].filter(Boolean).join('\n');

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          'You are a film previsualization supervisor writing prompts for image-to-video generation.',
          'Generate the actual video prompt. Do not act as an agent, do not mention tools, and do not explain your reasoning.',
          'The prompt must be physically executable and avoid AI-video failure modes: face drift, hand morphing, prop fusion, subtitles, impossible camera motion, montage, and overacting.',
          'Prefer one controlled shot with explicit time beats over broad story summary. If a reference image is attached, preserve it as the first-frame anchor.',
          'Output only the final English video prompt.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Movie: ${movie.title}`,
          story ? `Story context for continuity only: ${story}` : '',
          `Visual source: ${context.visualTitle} (${context.visualType})`,
          `Characters: ${characters || 'story characters'}`,
          `Target length: ${durationText}`,
          sceneText,
          visualContext,
          context.notes ? `User notes: ${context.notes}` : '',
          '',
          'Prompt requirements:',
          '- Define one shot only; no trailer, no montage, no subtitles, no dialogue lip-sync unless explicitly unavoidable.',
          '- Define shot size, camera stability/movement, lens feel, blocking, eyelines, foreground/midground/background, and practical light source.',
          '- Break motion into time beats such as 0-2s, 2-5s, 5-8s.',
          '- Keep hand/object interaction simple or already-settled if the reference image contains props.',
          '- Preserve character identity, wardrobe, prop placement, and spatial geography from the reference image.',
          '- Include negative constraints against morphing, extra props, random text, fake UI, poster lighting, and generic inspirational mood.',
        ].filter(Boolean).join('\n\n'),
      },
    ],
    { temperature: 0.3, maxTokens: 1600 }
  );

  const prompt = result.trim();
  if (!prompt) {
    throw new Error('LLM returned empty video prompt');
  }
  return prompt;
}

function parseStoryProposal(value?: string | null): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return [parsed.oneLiner, parsed.coreConflict, parsed.synopsis, parsed.styleReference].filter(Boolean).join(' ');
  } catch {
    return value;
  }
}

function resolveImagePaths(explicitPaths: string[], resultText: string): string[] {
  const paths = [...explicitPaths];
  const matches = resultText.match(/(?:\/[^\s"'`]+\.(?:png|jpe?g|webp))/gi) || [];
  for (const item of matches) {
    if (!paths.includes(item)) paths.push(item);
  }
  return paths.filter((item) => fs.existsSync(item) && fs.statSync(item).isFile());
}

function buildDoubaoCommand(inputJsonPath: string, outputDir: string, profileIds: string): string {
  const envParts = [
    'env',
    '-u', 'HTTP_PROXY',
    '-u', 'HTTPS_PROXY',
    '-u', 'ALL_PROXY',
    '-u', 'http_proxy',
    '-u', 'https_proxy',
    '-u', 'all_proxy',
    'PROXY_TASKS=',
    `DOUBAO_VIDEO_INPUT_JSON=${inputJsonPath}`,
    `DOUBAO_VIDEO_OUTPUT_DIR=${outputDir}`,
    `DOUBAO_VIDEO_PROFILE_IDS=${profileIds}`,
    'npm',
    'run',
    'doubao:video',
  ];
  return `cd ${shellQuote(DOUBAO_TASK_ROOT)} && ${envParts.map(shellQuote).join(' ')}`;
}

function runDoubaoVideoCommand(inputJsonPath: string, outputDir: string, profileIds: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'doubao:video'], {
      cwd: DOUBAO_TASK_ROOT,
      env: {
        ...process.env,
        DOUBAO_VIDEO_INPUT_JSON: inputJsonPath,
        DOUBAO_VIDEO_OUTPUT_DIR: outputDir,
        DOUBAO_VIDEO_PROFILE_IDS: profileIds,
        HF_ENDPOINT: process.env.HF_ENDPOINT || 'https://hf-mirror.com',
        HTTP_PROXY: '',
        HTTPS_PROXY: '',
        ALL_PROXY: '',
        http_proxy: '',
        https_proxy: '',
        all_proxy: '',
        PROXY_TASKS: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(output || `doubao video runner exited with code ${code}`));
      }
    });
  });
}

function normalizeList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return fallback;
}

function normalizeRatio(value: unknown): string {
  const ratio = typeof value === 'string' ? value.trim() : '';
  return ['16:9', '9:16', '1:1', '4:3', '3:4'].includes(ratio) ? ratio : '16:9';
}

function normalizeDuration(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(3, Math.min(30, Math.round(parsed)));
}

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
