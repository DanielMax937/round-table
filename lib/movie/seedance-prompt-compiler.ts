import type { LLMMessage } from '@/lib/llm/types';
import { buildSeedanceSkillOsContext } from '@/lib/movie/seedance-skill-os';

export type SeedanceGenerationMode = 'T2V' | 'I2V' | 'R2V';
export type SeedanceSequenceRelation = 'standalone_clip' | 'sequence_first_clip';
export type SeedanceShotStructure = 'compact_single_take' | 'phased_single_take' | 'dense_multishot';

export interface SeedancePromptCompilerInput {
  movieTitle: string;
  storyContext?: string;
  visualTitle: string;
  visualType: string;
  characters?: string;
  requestedDurationSeconds?: number;
  ratio?: string;
  sceneText?: string;
  visualPrompt?: string;
  visualResult?: string;
  notes?: string;
  sourceImagePaths?: string[];
}

export interface SeedanceReferenceRole {
  tag: string;
  sourcePath: string;
  role: string;
  transfer: string;
  doNotTransfer: string;
}

export interface SeedancePromptPlan {
  mode: SeedanceGenerationMode;
  sequenceRelation: SeedanceSequenceRelation;
  shotStructure: SeedanceShotStructure;
  requestedDurationSeconds: number;
  promptDurationSeconds: number;
  ratio: string;
  referenceRoles: SeedanceReferenceRole[];
  timeBeats: string[];
}

const MAX_SEEDANCE_PROMPT_DURATION_SECONDS = 15;
const MIN_SEEDANCE_PROMPT_DURATION_SECONDS = 4;
const MAX_IMAGE_REFERENCE_COUNT = 9;

export function buildSeedancePromptPlan(input: SeedancePromptCompilerInput): SeedancePromptPlan {
  const sourceImagePaths = input.sourceImagePaths || [];
  const requestedDurationSeconds = normalizeDuration(input.requestedDurationSeconds);
  const promptDurationSeconds = Math.max(
    MIN_SEEDANCE_PROMPT_DURATION_SECONDS,
    Math.min(MAX_SEEDANCE_PROMPT_DURATION_SECONDS, requestedDurationSeconds)
  );

  return {
    mode: classifyMode(sourceImagePaths),
    sequenceRelation: requestedDurationSeconds > MAX_SEEDANCE_PROMPT_DURATION_SECONDS
      ? 'sequence_first_clip'
      : 'standalone_clip',
    shotStructure: classifyShotStructure(input.visualType, promptDurationSeconds),
    requestedDurationSeconds,
    promptDurationSeconds,
    ratio: normalizeRatio(input.ratio),
    referenceRoles: buildReferenceRoles(sourceImagePaths, input.visualType),
    timeBeats: buildTimeBeats(promptDurationSeconds),
  };
}

export function buildSeedancePromptMessages(input: SeedancePromptCompilerInput): LLMMessage[] {
  const plan = buildSeedancePromptPlan(input);
  const skillOsContext = buildSeedanceSkillOsContext({
    mode: plan.mode,
    sequenceRelation: plan.sequenceRelation,
    shotStructure: plan.shotStructure,
    visualType: input.visualType,
    hasReferences: plan.referenceRoles.length > 0,
  });
  const referenceRoleMap = plan.referenceRoles.length
    ? plan.referenceRoles.map((ref) =>
      `${ref.tag}: ${ref.role}; transfer=${ref.transfer}; do_not_transfer=${ref.doNotTransfer}`
    ).join('\n')
    : 'No uploaded visual reference. Build the whole shot from text, but keep it compact.';

  return [
    {
      role: 'system',
      content: [
        '你是当前项目的视频提示词编译器。你必须依据下面 vendored Seedance 2.0 Skill OS 上游内容，把项目状态编译成一个当前 clip 的 Seedance 自然语言提示词。',
        '本地编译计划只提供项目状态、素材标签和生成边界；不得覆盖或虚构上游规则。',
        '最终只输出中文 Seedance 提示词正文，不输出解释、Markdown、JSON、YAML 或检查清单。',
        '',
        skillOsContext.content,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '## 编译计划',
        `Mode: ${plan.mode}`,
        `Sequence relation: ${plan.sequenceRelation}`,
        `Shot structure: ${plan.shotStructure}`,
        `Requested duration: ${plan.requestedDurationSeconds}s`,
        `Current clip prompt duration: ${plan.promptDurationSeconds}s`,
        `Ratio: ${plan.ratio}`,
        '',
        '## Reference role map',
        referenceRoleMap,
        '',
        '## Project state',
        `电影：${input.movieTitle}`,
        input.storyContext ? `故事背景：${truncate(input.storyContext, 700)}` : '',
        `视觉任务：${input.visualTitle}（${input.visualType}）`,
        input.characters ? `角色：${input.characters}` : '',
        input.sceneText ? `场景上下文：\n${truncate(input.sceneText, 1400)}` : '',
        input.visualPrompt ? `视觉资产原始设计提示词：\n${truncate(input.visualPrompt, 900)}` : '',
        input.visualResult ? `视觉资产生成记录：\n${truncate(input.visualResult, 700)}` : '',
        input.notes ? `用户/流水线备注：\n${truncate(input.notes, 800)}` : '',
        '',
        '## Time beats',
        plan.timeBeats.join('\n'),
        '',
        '## Local output boundary',
        '遵循 system 中加载的 Seedance Skill OS 输出契约。只输出当前 clip 的中文最终提示词；保留 Reference role map 中的 @ 标签原文。',
      ].filter(Boolean).join('\n'),
    },
  ];
}

function classifyMode(sourceImagePaths: string[]): SeedanceGenerationMode {
  if (sourceImagePaths.length === 0) return 'T2V';
  if (sourceImagePaths.length === 1) return 'I2V';
  return 'R2V';
}

function classifyShotStructure(visualType: string, durationSeconds: number): SeedanceShotStructure {
  if (visualType === 'storyboard' || visualType === 'comic') return 'dense_multishot';
  if (durationSeconds > 8) return 'phased_single_take';
  return 'compact_single_take';
}

function buildReferenceRoles(sourceImagePaths: string[], visualType: string): SeedanceReferenceRole[] {
  return sourceImagePaths.slice(0, MAX_IMAGE_REFERENCE_COUNT).map((sourcePath, index) => {
    const tag = `@图片${index + 1}`;
    if (index === 0) {
      return {
        tag,
        sourcePath,
        role: visualType === 'environment' ? 'first-frame environment anchor' : 'first-frame subject identity anchor',
        transfer: visualType === 'environment'
          ? 'opening composition, location geography, practical light placement'
          : 'opening composition, visible subject identity, wardrobe, prop ownership, color temperature',
        doNotTransfer: 'random text, extra props, unintended logos, unrelated style drift, future story beats',
      };
    }

    if (visualType === 'storyboard') {
      return {
        tag,
        sourcePath,
        role: 'shot-order and blocking reference',
        transfer: 'panel order, camera relationship, action rhythm, endpoint logic',
        doNotTransfer: 'storyboard borders as literal objects, unreadable captions, fused multi-panel composition',
      };
    }

    return {
      tag,
      sourcePath,
      role: 'continuity reference',
      transfer: 'environment continuity, material cues, lighting direction, prop placement',
      doNotTransfer: 'new identity, unauthorized logos, unrelated costume, unrelated location',
    };
  });
}

function buildTimeBeats(durationSeconds: number): string[] {
  if (durationSeconds <= 6) {
    const midpoint = Math.ceil(durationSeconds / 2);
    return [
      `0-${midpoint}s: 建立主体和动作起点，镜头只做一个清晰运动。`,
      `${midpoint}-${durationSeconds}s: 动作抵达端点，声音或光线给出明确落点。`,
    ];
  }

  if (durationSeconds <= 10) {
    const middleEnd = Math.min(6, durationSeconds - 2);
    return [
      '0-3s: 建立画面、主体、方向和物理光源。',
      `3-${middleEnd}s: 主体完成一个可见动作，镜头保持同一运动逻辑。`,
      `${middleEnd}-${durationSeconds}s: 停在明确端点，不引入下一个剧情动作。`,
    ];
  }

  return [
    '0-4s: 建立主体、空间关系、运动方向和声音基调。',
    `4-${Math.min(10, durationSeconds - 3)}s: 单一动作逐步推进，只改变动作或镜头中的一个主变量。`,
    `${Math.min(10, durationSeconds - 3)}-${durationSeconds}s: 抵达端点，保留下一段动作，不提前展示。`,
  ];
}

function normalizeRatio(value: string | undefined): string {
  return value && ['16:9', '9:16', '1:1', '4:3', '3:4'].includes(value) ? value : '16:9';
}

function normalizeDuration(value: number | undefined): number {
  const parsed = Number(value || 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(MIN_SEEDANCE_PROMPT_DURATION_SECONDS, Math.round(parsed));
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
