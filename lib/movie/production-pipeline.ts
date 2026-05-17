import { prisma } from '@/lib/prisma';
import {
  createVisualAssetJobs,
  executeVisualAssetJob,
  type VisualAssetType,
  type VisualStyle,
} from '@/lib/movie/visual-assets';
import {
  createVideoGenerationJobs,
  executeVideoGenerationJob,
} from '@/lib/movie/video-assets';
import {
  createQualityReviewJob,
  executeQualityReviewJob,
  type QualityTargetType,
} from '@/lib/movie/quality-reviewer';

export type ProductionPipelineLevel = 'quick' | 'director' | 'producer';

export interface ProductionPipelineRequest {
  level: ProductionPipelineLevel;
  sceneIds?: string[];
  styles?: VisualStyle[];
  runVisual?: boolean;
  runVideo?: boolean;
  runQuality?: boolean;
  profileIds?: string;
  notes?: string;
}

interface PipelineSceneResult {
  sceneId: string;
  sceneNumber: number;
  heading: string;
  status: 'completed' | 'blocked' | 'failed';
  blocker?: string;
  scriptReviewJobId?: string;
  scriptPassed?: boolean;
  visualAssetJobIds: string[];
  visualReviewJobIds: string[];
  videoGenerationJobIds: string[];
  videoReviewJobIds: string[];
}

const LEVEL_PROFILES: Record<ProductionPipelineLevel, {
  label: string;
  assetTypes: VisualAssetType[];
  durationSeconds: number;
}> = {
  quick: {
    label: '快速模式',
    assetTypes: ['keyframe'],
    durationSeconds: 8,
  },
  director: {
    label: '导演模式',
    assetTypes: ['keyframe', 'storyboard', 'environment'],
    durationSeconds: 10,
  },
  producer: {
    label: '制片模式',
    assetTypes: ['keyframe', 'storyboard', 'environment', 'character_look'],
    durationSeconds: 12,
  },
};

export function normalizeProductionPipelineRequest(input: Partial<ProductionPipelineRequest>): ProductionPipelineRequest {
  return {
    level: isPipelineLevel(input.level) ? input.level : 'quick',
    sceneIds: normalizeList(input.sceneIds),
    styles: normalizeStyles(input.styles),
    runVisual: Boolean(input.runVisual),
    runVideo: Boolean(input.runVideo),
    runQuality: input.runQuality !== false,
    profileIds: typeof input.profileIds === 'string' && input.profileIds.trim() ? input.profileIds.trim() : '1',
    notes: typeof input.notes === 'string' ? input.notes.trim() : '',
  };
}

export async function runProductionPipeline(movieId: string, request: ProductionPipelineRequest) {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    include: {
      scenes: {
        orderBy: { sceneNumber: 'asc' },
        include: {
          sceneCharacters: {
            orderBy: { order: 'asc' },
            include: { character: true },
          },
        },
      },
    },
  });
  if (!movie) throw new Error('Movie not found');

  const profile = LEVEL_PROFILES[request.level];
  const scenes = selectScenes(movie.scenes, request.sceneIds);
  if (!scenes.length) {
    throw new Error('No finalized scenes found for production pipeline');
  }

  const run = await prisma.productionPipelineRun.create({
    data: {
      movieId,
      level: request.level,
      status: 'running',
      sceneIdsJson: JSON.stringify(scenes.map((scene) => scene.id)),
      optionsJson: JSON.stringify({
        ...request,
        label: profile.label,
        assetTypes: profile.assetTypes,
      }),
      startedAt: new Date(),
    },
  });

  const results: PipelineSceneResult[] = [];
  try {
    for (const scene of scenes) {
      results.push(await runScenePipeline(movieId, scene, request, profile.assetTypes, profile.durationSeconds));
    }

    const status = results.some((item) => item.status === 'failed') ? 'failed' : 'completed';
    return prisma.productionPipelineRun.update({
      where: { id: run.id },
      data: {
        status,
        resultJson: JSON.stringify({ scenes: results }),
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.productionPipelineRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        resultJson: JSON.stringify({ scenes: results }),
        error: error instanceof Error ? error.message.slice(0, 4000) : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function runScenePipeline(
  movieId: string,
  scene: {
    id: string;
    sceneNumber: number;
    heading: string;
    finalizedScript?: string | null;
    sceneCharacters: Array<{ character: { id: string; name: string } }>;
  },
  request: ProductionPipelineRequest,
  assetTypes: VisualAssetType[],
  durationSeconds: number
): Promise<PipelineSceneResult> {
  const result: PipelineSceneResult = {
    sceneId: scene.id,
    sceneNumber: scene.sceneNumber,
    heading: scene.heading,
    status: 'completed',
    visualAssetJobIds: [],
    visualReviewJobIds: [],
    videoGenerationJobIds: [],
    videoReviewJobIds: [],
  };

  if (!scene.finalizedScript?.trim()) {
    return { ...result, status: 'blocked', blocker: '场景还没有终稿剧本，无法进入图片/视频产制。' };
  }

  if (request.runQuality) {
    const scriptReview = await runReview(movieId, 'script', scene.id);
    result.scriptReviewJobId = scriptReview.id;
    result.scriptPassed = scriptReview.passed;
    if (!scriptReview.passed) {
      return { ...result, status: 'blocked', blocker: '剧本质检未通过，已停止后续图片/视频生成。' };
    }
  }

  const characterIds = scene.sceneCharacters.map((item) => item.character.id);
  const visualJobs = await createVisualAssetJobs(movieId, {
    assetTypes,
    styles: request.styles || ['live_action'],
    sceneIds: [scene.id],
    characterIds: assetTypes.includes('character_look') ? characterIds : [],
    notes: buildPipelineNotes(request),
    run: false,
  });
  result.visualAssetJobIds = visualJobs.map((job) => job.id);

  if (request.runVisual) {
    for (const job of visualJobs) {
      await executeVisualAssetJob(job.id);
    }
  }

  if (request.runQuality) {
    for (const job of visualJobs) {
      const review = await runReview(movieId, 'visual_asset', job.id);
      result.visualReviewJobIds.push(review.id);
    }
  }

  const keyframe = visualJobs.find((job) => job.assetType === 'keyframe') || visualJobs[0];
  if (keyframe) {
    const videoJobs = await createVideoGenerationJobs(movieId, {
      visualAssetJobIds: [keyframe.id],
      ratio: '16:9',
      durationSeconds,
      profileIds: request.profileIds || '1',
      notes: buildPipelineNotes(request),
      run: false,
    });
    result.videoGenerationJobIds = videoJobs.map((job) => job.id);

    if (request.runVideo) {
      for (const job of videoJobs) {
        await executeVideoGenerationJob(job.id, request.profileIds || '1');
      }
    }

    if (request.runQuality) {
      for (const job of videoJobs) {
        const review = await runReview(movieId, 'video', job.id);
        result.videoReviewJobIds.push(review.id);
      }
    }
  }

  return result;
}

async function runReview(movieId: string, targetType: QualityTargetType, targetId: string) {
  const job = await createQualityReviewJob(movieId, { targetType, targetId, run: false });
  await executeQualityReviewJob(job.id);
  const finalJob = await prisma.qualityReviewJob.findUnique({ where: { id: job.id } });
  if (!finalJob) throw new Error(`Quality review job ${job.id} not found after execution`);
  return finalJob;
}

function selectScenes<T extends { id: string; finalizedScript?: string | null }>(scenes: T[], sceneIds?: string[]): T[] {
  const selected = new Set(sceneIds || []);
  const targets = selected.size > 0
    ? scenes.filter((scene) => selected.has(scene.id))
    : scenes.filter((scene) => scene.finalizedScript?.trim()).slice(0, 1);
  return targets;
}

function buildPipelineNotes(request: ProductionPipelineRequest): string {
  const levelNotes: Record<ProductionPipelineLevel, string> = {
    quick: 'Pipeline level: quick previz. Prioritize one strong deliverable keyframe and one simple executable video shot.',
    director: 'Pipeline level: director package. Prioritize blocking, shot design, spatial geography, and continuity for review.',
    producer: 'Pipeline level: producer package. Prioritize reusable assets, character continuity, production feasibility, and downstream handoff.',
  };
  return [levelNotes[request.level], request.notes].filter(Boolean).join('\n');
}

function normalizeStyles(value: unknown): VisualStyle[] {
  const styles = normalizeList(value).filter((item): item is VisualStyle =>
    ['animation', 'cg_animation', 'live_action', 'manga', 'ink_storyboard', 'photorealistic', 'concept_art'].includes(item)
  );
  return styles.length ? styles : ['live_action'];
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function isPipelineLevel(value: unknown): value is ProductionPipelineLevel {
  return value === 'quick' || value === 'director' || value === 'producer';
}
