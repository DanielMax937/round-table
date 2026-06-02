import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type {
  CharacterProfile,
  DevelopmentReport,
  ScreenplayPromptPack,
  StoryBible,
  StoryProposal,
} from './types';

export interface DevelopmentInput {
  movieTitle: string;
  theme?: string | null;
  proposal: StoryProposal;
  characters?: CharacterProfile[];
}

export async function generateDevelopmentReport(
  input: DevelopmentInput
): Promise<DevelopmentReport> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        '你是一位影视开发读本编辑、故事顾问和制片开发顾问。',
        '你的任务不是写正文，而是把故事提案诊断成可执行的影视开发报告。',
        '只输出合法 JSON，不要 markdown，不要解释 JSON 之外的内容。',
      ].join('\n'),
    },
    { role: 'user', content: buildDevelopmentReportPrompt(input) },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.35, maxTokens: 8192 });
  return normalizeDevelopmentReport(parseJsonObject(raw));
}

export async function generateStoryBible(input: {
  movieTitle: string;
  proposal: StoryProposal;
  report: DevelopmentReport;
  characters?: CharacterProfile[];
}): Promise<StoryBible> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        '你是影视项目的总架构师，负责把开发读本转成创作生产用的故事圣经。',
        '故事圣经必须能约束角色、场景大纲、剧本生成和小说改编。',
        '只输出合法 JSON，不要 markdown，不要解释 JSON 之外的内容。',
      ].join('\n'),
    },
    { role: 'user', content: buildStoryBiblePrompt(input) },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.45, maxTokens: 8192 });
  return normalizeStoryBible(parseJsonObject(raw), input.report);
}

export function parseDevelopmentReport(value: string | null | undefined): DevelopmentReport | null {
  if (!value?.trim()) return null;
  try {
    return normalizeDevelopmentReport(JSON.parse(value));
  } catch {
    return null;
  }
}

export function parseStoryBible(value: string | null | undefined): StoryBible | null {
  if (!value?.trim()) return null;
  try {
    return normalizeStoryBible(JSON.parse(value));
  } catch {
    return null;
  }
}

export function formatDevelopmentContext(input: {
  report?: DevelopmentReport | null;
  bible?: StoryBible | null;
  maxChars?: number;
}): string {
  const blocks: string[] = [];
  if (input.report) {
    blocks.push([
      '# 开发读本摘要',
      `诊断等级：${input.report.quickDiagnosis.grade}，${input.report.quickDiagnosis.reason}`,
      `类型/基调：${input.report.projectInfo.genre} / ${input.report.projectInfo.tone}`,
      `一句话：${input.report.projectInfo.logline}`,
      `核心冲突：${input.report.premise.coreConflict}`,
      `最大风险：${input.report.quickDiagnosis.biggestRisk}`,
      `开发建议：${input.report.developmentRecommendations.join('；')}`,
      `剧本化危险区：${input.report.screenplayPromptPack.dangerZones.join('；')}`,
    ].join('\n'));
  }
  if (input.bible) {
    blocks.push([
      '# 故事圣经',
      `中心命题：${input.bible.controllingIdea}`,
      `世界/规则：${input.bible.worldRules.join('；')}`,
      `语气规则：${input.bible.toneRules.join('；')}`,
      `不可破坏：${input.bible.doNotBreak.join('；')}`,
      `物件/母题：${input.bible.objectMotifs.join('；')}`,
      '# 弧线规划',
      input.bible.arcs.map((arc) =>
        `- ${arc.act} / ${arc.arcName}: ${arc.objective}；KR=${arc.keyResults.join('、')}；钩子=${arc.setupPayoffs.join('、')}；视觉母题=${arc.visualMotifs.join('、')}`
      ).join('\n'),
    ].join('\n'));
  }

  const context = blocks.join('\n\n');
  const maxChars = input.maxChars ?? 6000;
  return context.length > maxChars ? `${context.slice(0, maxChars)}...` : context;
}

function buildDevelopmentReportPrompt(input: DevelopmentInput): string {
  const characterBlock = input.characters?.length
    ? input.characters.map((c) =>
        `- ${c.name}：${c.personalityTraits}；目标=${c.surfaceGoal}；动机=${c.deepMotivation}；缺陷=${c.fatalFlaw}`
      ).join('\n')
    : '（尚未生成角色，请按提案推断核心人物功能）';

  return `请基于下面项目信息，输出影视开发读本 JSON。

# 项目
片名：${input.movieTitle}
主题：${input.theme || '未填写'}

# 已确认故事提案
一句话：${input.proposal.oneLiner}
核心冲突：${input.proposal.coreConflict}
风格参考：${input.proposal.styleReference}
故事梗概：${input.proposal.synopsis}

# 当前角色
${characterBlock}

# 诊断要求
先做快速诊断：A=可直接开发，B=可开发但需强化，C=需大改，D=不适合影视化，D0=只有概念没有故事。
然后输出完整开发读本，必须包含结构、人物、商业定位、改编潜力、风险和可直接喂给 AI 剧本生成器的 screenplayPromptPack。

# JSON 格式
{
  "quickDiagnosis": {
    "grade": "A|B|C|D|D0",
    "reason": "为什么是这个等级",
    "biggestOpportunity": "最大开发机会",
    "biggestRisk": "最大开发风险"
  },
  "projectInfo": {
    "title": "${input.movieTitle}",
    "genre": "类型",
    "tone": "基调",
    "targetAudience": "目标观众",
    "logline": "一句话 logline"
  },
  "premise": {
    "coreConflict": "核心冲突",
    "theme": "主题命题",
    "dramaticQuestion": "戏剧问题",
    "transformation": "主角/关系变化"
  },
  "structure": {
    "actOne": "第一幕",
    "actTwo": "第二幕",
    "actThree": "第三幕",
    "turningPoints": ["转折点1", "转折点2", "转折点3"]
  },
  "characterAnalysis": [
    {
      "name": "人物名或功能名",
      "function": "叙事功能",
      "motivation": "动机",
      "arc": "变化弧线",
      "relationshipPressure": "关系压力"
    }
  ],
  "adaptationPotential": {
    "visualValue": "视听价值",
    "productionNotes": "制片注意",
    "adaptationChallenges": ["挑战1"]
  },
  "marketPositioning": {
    "comparableWorks": ["对标作品1", "对标作品2"],
    "sellingPoints": ["卖点1", "卖点2"],
    "audienceHook": "观众入口"
  },
  "developmentRecommendations": ["具体建议1", "具体建议2"],
  "screenplayPromptPack": {
    "immutableFacts": ["不可改事实"],
    "characterRules": ["人物行为规则"],
    "requiredScenes": ["必须保留/生成的关键场"],
    "safeToChange": ["可合并/可删改项"],
    "dangerZones": ["最容易跑偏的方式"],
    "visualAnchors": ["物件/空间/动作母题"],
    "rewritePriorities": ["修订优先级"]
  }
}`;
}

function buildStoryBiblePrompt(input: {
  movieTitle: string;
  proposal: StoryProposal;
  report: DevelopmentReport;
  characters?: CharacterProfile[];
}): string {
  const characterBlock = input.characters?.length
    ? input.characters.map((c) =>
        `- ${c.name}：${c.personalityTraits}；目标=${c.surfaceGoal}；动机=${c.deepMotivation}；缺陷=${c.fatalFlaw}`
      ).join('\n')
    : '（角色可在后续由此故事圣经生成）';

  return `请把开发读本转成生产用故事圣经 JSON。

# 项目
${input.movieTitle}

# 故事提案
${JSON.stringify(input.proposal, null, 2)}

# 开发读本
${JSON.stringify(input.report, null, 2)}

# 已有角色
${characterBlock}

# 输出要求
1. arcs 至少 3 个，对应三幕或清晰阶段。
2. 每个 arc 要给场景大纲可用的 objective、keyResults、emotionalCurve、setupPayoffs、visualMotifs。
3. hookLedger 要追踪伏笔/承诺，不要只写主题词。
4. screenplayPromptPack 可以继承开发读本，但要更具体、更适合场景生成和修订。

# JSON 格式
{
  "controllingIdea": "中心命题",
  "worldRules": ["故事世界/社会/职业/家庭规则"],
  "toneRules": ["语气、节奏、幽默/悬疑/情绪规则"],
  "arcs": [
    {
      "act": "第一幕",
      "arcName": "弧线名",
      "objective": "本弧线可验证目标",
      "keyResults": ["关键结果1", "关键结果2", "关键结果3"],
      "emotionalCurve": "情绪曲线",
      "setupPayoffs": ["埋设/回收承诺"],
      "visualMotifs": ["物件或空间母题"]
    }
  ],
  "characterDesignRules": ["角色生成/表演时必须遵守的规则"],
  "hookLedger": [
    {
      "hook": "伏笔或承诺",
      "plantedIn": "预计埋设位置",
      "payoffBy": "预计回收位置",
      "status": "planned"
    }
  ],
  "objectMotifs": ["关键物件/空间/动作"],
  "doNotBreak": ["不可破坏的故事事实/人物逻辑"],
  "screenplayPromptPack": {
    "immutableFacts": ["不可改事实"],
    "characterRules": ["人物行为规则"],
    "requiredScenes": ["必须保留/生成的关键场"],
    "safeToChange": ["可合并/可删改项"],
    "dangerZones": ["最容易跑偏的方式"],
    "visualAnchors": ["物件/空间/动作母题"],
    "rewritePriorities": ["修订优先级"]
  }
}`;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;
  const json = extractFirstJsonObject(candidate) || candidate;
  return JSON.parse(json.trim()) as Record<string, unknown>;
}

function extractFirstJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < value.length; i++) {
    const char = value[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, i + 1);
      }
    }
  }

  return null;
}

function normalizeDevelopmentReport(value: any): DevelopmentReport {
  const pack = normalizePromptPack(value?.screenplayPromptPack);
  const grade = String(value?.quickDiagnosis?.grade || 'C').toUpperCase();
  return {
    quickDiagnosis: {
      grade: ['A', 'B', 'C', 'D', 'D0'].includes(grade) ? grade as DevelopmentReport['quickDiagnosis']['grade'] : 'C',
      reason: str(value?.quickDiagnosis?.reason),
      biggestOpportunity: str(value?.quickDiagnosis?.biggestOpportunity),
      biggestRisk: str(value?.quickDiagnosis?.biggestRisk),
    },
    projectInfo: {
      title: str(value?.projectInfo?.title),
      genre: str(value?.projectInfo?.genre),
      tone: str(value?.projectInfo?.tone),
      targetAudience: str(value?.projectInfo?.targetAudience),
      logline: str(value?.projectInfo?.logline),
    },
    premise: {
      coreConflict: str(value?.premise?.coreConflict),
      theme: str(value?.premise?.theme),
      dramaticQuestion: str(value?.premise?.dramaticQuestion),
      transformation: str(value?.premise?.transformation),
    },
    structure: {
      actOne: str(value?.structure?.actOne),
      actTwo: str(value?.structure?.actTwo),
      actThree: str(value?.structure?.actThree),
      turningPoints: list(value?.structure?.turningPoints),
    },
    characterAnalysis: Array.isArray(value?.characterAnalysis)
      ? value.characterAnalysis.map((item: any) => ({
          name: str(item?.name),
          function: str(item?.function),
          motivation: str(item?.motivation),
          arc: str(item?.arc),
          relationshipPressure: str(item?.relationshipPressure),
        }))
      : [],
    adaptationPotential: {
      visualValue: str(value?.adaptationPotential?.visualValue),
      productionNotes: str(value?.adaptationPotential?.productionNotes),
      adaptationChallenges: list(value?.adaptationPotential?.adaptationChallenges),
    },
    marketPositioning: {
      comparableWorks: list(value?.marketPositioning?.comparableWorks),
      sellingPoints: list(value?.marketPositioning?.sellingPoints),
      audienceHook: str(value?.marketPositioning?.audienceHook),
    },
    developmentRecommendations: list(value?.developmentRecommendations),
    screenplayPromptPack: pack,
  };
}

function normalizeStoryBible(value: any, report?: DevelopmentReport): StoryBible {
  const fallbackPack = report?.screenplayPromptPack;
  return {
    controllingIdea: str(value?.controllingIdea),
    worldRules: list(value?.worldRules),
    toneRules: list(value?.toneRules),
    arcs: Array.isArray(value?.arcs)
      ? value.arcs.map((item: any) => ({
          act: str(item?.act),
          arcName: str(item?.arcName),
          objective: str(item?.objective),
          keyResults: list(item?.keyResults),
          emotionalCurve: str(item?.emotionalCurve),
          setupPayoffs: list(item?.setupPayoffs),
          visualMotifs: list(item?.visualMotifs),
        }))
      : [],
    characterDesignRules: list(value?.characterDesignRules),
    hookLedger: Array.isArray(value?.hookLedger)
      ? value.hookLedger.map((item: any) => ({
          hook: str(item?.hook),
          plantedIn: str(item?.plantedIn),
          payoffBy: str(item?.payoffBy),
          status: item?.status === 'open' || item?.status === 'resolved' ? item.status : 'planned',
        }))
      : [],
    objectMotifs: list(value?.objectMotifs),
    doNotBreak: list(value?.doNotBreak),
    screenplayPromptPack: normalizePromptPack(value?.screenplayPromptPack, fallbackPack),
  };
}

function normalizePromptPack(value: any, fallback?: ScreenplayPromptPack): ScreenplayPromptPack {
  return {
    immutableFacts: list(value?.immutableFacts, fallback?.immutableFacts),
    characterRules: list(value?.characterRules, fallback?.characterRules),
    requiredScenes: list(value?.requiredScenes, fallback?.requiredScenes),
    safeToChange: list(value?.safeToChange, fallback?.safeToChange),
    dangerZones: list(value?.dangerZones, fallback?.dangerZones),
    visualAnchors: list(value?.visualAnchors, fallback?.visualAnchors),
    rewritePriorities: list(value?.rewritePriorities, fallback?.rewritePriorities),
  };
}

function list(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function str(value: unknown): string {
  return String(value ?? '').trim();
}
