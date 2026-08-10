import type { LLMMessage } from '@/lib/llm/types';
import { buildHiggsfieldPromptContext } from '@/lib/movie/higgsfield-prompt-context';
import {
  buildSeedancePromptMessages,
  type SeedancePromptCompilerInput,
} from '@/lib/movie/seedance-prompt-compiler';
import {
  normalizeVideoPromptMode,
  type VideoPromptMode,
} from '@/lib/movie/video-prompt-mode-contract';

export interface VideoPromptStrategyInput extends SeedancePromptCompilerInput {
  promptMode?: VideoPromptMode;
}

export function buildVideoPromptMessages(input: VideoPromptStrategyInput): LLMMessage[] {
  switch (normalizeVideoPromptMode(input.promptMode)) {
    case 'higgsfield':
      return buildHiggsfieldVideoPromptMessages(input);
    case 'hybrid':
      return buildHybridVideoPromptMessages(input);
    default:
      return buildClassicVideoPromptMessages(input);
  }
}

export function buildClassicVideoPromptMessages(input: VideoPromptStrategyInput): LLMMessage[] {
  return buildSeedancePromptMessages(input);
}

export function buildHiggsfieldVideoPromptMessages(input: VideoPromptStrategyInput): LLMMessage[] {
  const context = buildHiggsfieldPromptContext({
    mode: 'pure',
    visualType: input.visualType,
    hasReferences: Boolean(input.sourceImagePaths?.length),
    hasDialogue: hasDialogue(input.sceneText),
  });
  const productionPlan = buildProductionPlan(input);

  return [
    {
      role: 'system',
      content: [
        'HIGGSFIELD_PURE_MODE',
        '你是 Higgsfield Hell Grind 制作体系下的 CINEDANCE 视频导演。',
        '只依据下面提供的已提交 Higgsfield 资料工作；不要回退到经典模板，也不要发明资料中不存在的规则。',
        '资料中的 Hell Grind 人名、剧情、对白和镜头只是方法示例；当前项目事实只来自 user 提供的 production brief。',
        '将情绪改写为可见行为，将抽象动作改写为重心、接触、反作用和结束状态。',
        '遵循 CINEDANCE 的交付语言：最终只输出当前一个 clip 的清晰电影化英文提示词；原始对白逐字保留。',
        '',
        context.content,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '# Current clip production brief',
        buildProjectState(input),
        '',
        '## Reference role map',
        productionPlan.referenceRoleMap,
        '',
        '## Beat timeline',
        productionPlan.timeBeats.join('\n'),
        '',
        '## Delivery contract',
        '- 建立可拍摄的开场构图、一个主动作、一个主运镜和明确结束构图。',
        '- 每个引用只继承声明的职责，禁止把服装、背景、构图和身份无差别混合。',
        '- 表演使用动作、呼吸、视线、停顿、距离和身体状态表达，不直接写抽象情绪。',
        '- 保持角色数量、场景地理、屏幕方向、光源逻辑和接触点连续。',
        '- 对白逐字保留，并写明说话方式、环境声和关键同步音效。',
        '- 使用清晰直接的电影化英文，只输出提示词，不输出分析、来源、Markdown 标题或检查清单；对白保持原文。',
      ].join('\n'),
    },
  ];
}

export function buildHybridVideoPromptMessages(input: VideoPromptStrategyInput): LLMMessage[] {
  const classic = buildClassicVideoPromptMessages(input);
  const context = buildHiggsfieldPromptContext({
    mode: 'hybrid',
    visualType: input.visualType,
    hasReferences: Boolean(input.sourceImagePaths?.length),
    hasDialogue: hasDialogue(input.sceneText),
  });
  const productionPlan = buildProductionPlan(input);

  return [
    {
      role: 'system',
      content: [
        classic[0].content,
        '',
        'HIGGSFIELD_HYBRID_MODE',
        '保留以上经典模式的输入输出契约和用户硬约束，再用下面 Higgsfield 资料做定向增强。',
        '增强只能让镜头更可执行，不得改写人物身份、数量、对白、时长、比例或剧情结果。',
        '',
        context.content,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        classic[1].content,
        '',
        '## Higgsfield enhancement checklist',
        `Reference roles:\n${productionPlan.referenceRoleMap}`,
        '- 把情绪词改成具体表演行为、眼神、呼吸、停顿、姿态和人物距离。',
        '- 给动作补足触发、接触、反作用和稳定结束状态。',
        '- 锁定开场/结束构图、单一主运镜、场景地理、人物数量和光源逻辑。',
        '- 删除会制造 AI slop 的装饰性形容词、重复命令和无关负向词。',
        '- 最终仍只输出经典模式要求的中文提示词正文。',
      ].join('\n'),
    },
  ];
}

function buildProjectState(input: VideoPromptStrategyInput): string {
  return [
    `电影：${input.movieTitle}`,
    input.storyContext ? `故事连续性：${input.storyContext}` : '',
    `视觉任务：${input.visualTitle}（${input.visualType}）`,
    `角色：${input.characters || '故事角色'}`,
    `时长：${normalizeDuration(input.requestedDurationSeconds)}秒`,
    `比例：${normalizeRatio(input.ratio)}`,
    input.sceneText ? `场景与剧本：\n${input.sceneText}` : '',
    input.visualPrompt ? `视觉资产设计：\n${truncate(input.visualPrompt, 1200)}` : '',
    input.visualResult ? `视觉资产结果：\n${truncate(input.visualResult, 900)}` : '',
    input.notes ? `用户备注：\n${input.notes}` : '',
  ].filter(Boolean).join('\n\n');
}

function buildProductionPlan(input: VideoPromptStrategyInput): {
  referenceRoleMap: string;
  timeBeats: string[];
} {
  const paths = input.sourceImagePaths || [];
  const referenceRoleMap = paths.length
    ? paths.slice(0, 9).map((_, index) => {
      const tag = `@图片${index + 1}`;
      if (index === 0) {
        return `${tag}: 主体身份与当前状态锚点；继承人物/主体，不继承背景和无关构图。`;
      }
      if (index === 1) {
        return `${tag}: 场景地理、光线与构图锚点；不覆盖主体身份。`;
      }
      return `${tag}: 补充动作、道具或材质参考；只继承提示词明确指定的部分。`;
    }).join('\n')
    : '无视觉引用：完全依据文本建立主体、场景、动作和摄影。';

  const duration = normalizeDuration(input.requestedDurationSeconds);
  const midpoint = Math.ceil(duration / 2);
  const timeBeats = duration <= 8
    ? [
      `0-${midpoint}秒：建立位置、视线、身体状态和动作触发。`,
      `${midpoint}-${duration}秒：完成主动作、反作用与稳定结束状态。`,
    ]
    : [
      '0-3秒：锁定开场构图、人物数量、位置和第一动作。',
      `3-${Math.min(7, duration - 2)}秒：主动作在单一镜头逻辑中发展。`,
      `${Math.min(7, duration - 2)}-${duration}秒：反作用落定并形成可剪辑的结束构图。`,
    ];

  return { referenceRoleMap, timeBeats };
}

function normalizeDuration(value?: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(4, Math.min(15, Math.round(value as number)));
}

function normalizeRatio(value?: string): string {
  return value && /^\d+:\d+$/.test(value.trim()) ? value.trim() : '16:9';
}

function hasDialogue(sceneText?: string): boolean {
  return Boolean(sceneText && /(dialogue|对话|对白|台词|“|”|\")/i.test(sceneText));
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}
