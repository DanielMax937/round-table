import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { CharacterState } from './types';
import type { DevelopmentReport, StoryBible } from './types';
import { formatDevelopmentContext } from './development';

interface CharacterForScene {
  id: string;
  name: string;
  backstory: string;
  personalityTraits: string;
  surfaceGoal?: string | null;
  deepMotivation?: string | null;
  fatalFlaw?: string | null;
  signatureLanguageStyle?: string | null;
  currentStateJson?: string | null;
}

export interface DirectorActorInput {
  movieTitle: string;
  sceneHeading: string;
  contentSummary: string;
  emotionalGoal: string;
  plotSummary: string;
  developmentReport?: DevelopmentReport | null;
  storyBible?: StoryBible | null;
  scenePlanning?: {
    act?: string | null;
    arcName?: string | null;
    arcGoal?: string | null;
    setupPayoff?: string | null;
    requiredMotif?: string | null;
  } | null;
  characters: CharacterForScene[];
}

/**
 * Director generates full scene in one pass (screenplay format).
 * Uses character profiles, plot summary, and current states.
 * Non-streaming: returns full script when complete.
 */
export async function generateSceneWithDirector(
  input: DirectorActorInput
): Promise<{ fullScript: string }> {
  const prompt = buildDirectorPrompt(input);
  const messages: LLMMessage[] = [{ role: 'user', content: prompt }];

  const fullScript = await chatCompletion(messages, { temperature: 0.8, maxTokens: 8192 });
  return { fullScript: fullScript.trim() };
}

function buildDirectorPrompt(input: DirectorActorInput): string {
  let p = `你是一位专业电影导演和编剧。写一个完整的场景剧本。

# 电影
${input.movieTitle}

# 场景
**${input.sceneHeading}**
${input.contentSummary}

# 情感目标
${input.emotionalGoal}

# 剧情背景
${input.plotSummary || '（故事开端）'}

${formatPlanningContext(input)}

# 本场角色
`;
  for (const c of input.characters) {
    const state = parseCharacterState(c.currentStateJson);
    p += `\n## ${c.name}\n`;
    p += `- 背景：${c.backstory.substring(0, 150)}${c.backstory.length > 150 ? '...' : ''}\n`;
    p += `- 性格：${c.personalityTraits}\n`;
    if (c.surfaceGoal) p += `- 表面目标：${c.surfaceGoal}\n`;
    if (c.deepMotivation) p += `- 深层动机：${c.deepMotivation}\n`;
    if (c.fatalFlaw) p += `- 致命缺陷：${c.fatalFlaw}\n`;
    if (c.signatureLanguageStyle) p += `- 语言风格：${c.signatureLanguageStyle}\n`;
    if (state) {
      if (state.emotionalState) p += `- 当前情感状态：${state.emotionalState}\n`;
      if (state.physicalState) p += `- 当前身体状态：${state.physicalState}\n`;
      if (state.knowledge?.length) p += `- 已知信息：${state.knowledge.join('；')}\n`;
    }
  }

  p += `

# 写作要求
1. 以场景标题开头（INT./EXT. 地点 - 时间），地点使用中文
2. 添加简要的动作/场景描写
3. 对话格式：角色名大写，可选括号提示，然后是对话
4. 在对话之间加入动作节拍
5. 实现本场的情感目标
6. 保持每个角色的声音和性格
7. 输出干净的剧本文本——不要 markdown，不要代码块
8. 当场景冲突完成时结束（通常1-3页）
9. **语言**：所有旁白、场景描述、动作说明、角色对话统一使用中文，不要夹英文。
10. **反重复**：同一场景内，不要重复使用相同的动作描写（如"手指颤抖"、"指尖冰凉"）。每个动作只出现一次。`;
  return p;
}

function parseCharacterState(json: string | null | undefined): CharacterState | null {
  if (!json?.trim()) return null;
  try {
    return JSON.parse(json) as CharacterState;
  } catch {
    return null;
  }
}

/**
 * Director generates a scene summary BEFORE agents speak.
 * Describes what happens and each character's expected behavior for agents to reference.
 */
export async function generateDirectorSceneSummary(
  input: DirectorActorInput
): Promise<string> {
  const prompt = buildDirectorSummaryPrompt(input);
  const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
  const result = await chatCompletion(messages, { temperature: 0.7, maxTokens: 4096 });
  return result.trim();
}

function buildDirectorSummaryPrompt(input: DirectorActorInput): string {
  let p = `你是一位专业电影导演。在演员（角色）开始即兴表演前，你需要先给出这场戏的「场景概要」，指导演员把握方向。

# 电影
${input.movieTitle}

# 场景
**${input.sceneHeading}**
${input.contentSummary}

# 情感目标
${input.emotionalGoal}

# 剧情背景
${input.plotSummary || '（故事开端）'}

${formatPlanningContext(input)}

# 本场角色
`;
  for (const c of input.characters) {
    p += `- ${c.name}：${c.personalityTraits}${c.surfaceGoal ? `，长期目标/压力：${c.surfaceGoal}` : ''}\n`;
  }

  p += `

# 输出要求
请用中文写一段「场景概要」（200-400字），包含：
1. **场景大概内容**：这一场发生了什么、主要冲突或看点
2. **每个人的大概表现**：每个角色在本场的态度、情绪、行为倾向（各1-2句）
3. **每个人的真人化抓手**：为每个角色给出本场私密目标、害怕暴露的点、防御动作/语言习惯，以及本场绝对不要说的空话
4. **本场推进顺序**：用自然语言给出 3-5 个递进 beat，让演员从开场反应、试探、冲突/信息揭露走向情感目标

注意：角色的长期目标只作为潜台词，不要把它误写成本场目标；本场目标必须来自当前场景描述和情感目标。
注意：不要把角色写成观点代表。每个人都必须有面子、误会、私心、身体动作和眼前要处理的小麻烦。

直接输出概要文本，不要用 markdown 标题，不要写「场景概要：」等前缀。`;
  return p;
}

function formatPlanningContext(input: DirectorActorInput): string {
  const planningParts = [
    input.scenePlanning?.act ? `幕/阶段：${input.scenePlanning.act}` : null,
    input.scenePlanning?.arcName ? `叙事弧线：${input.scenePlanning.arcName}` : null,
    input.scenePlanning?.arcGoal ? `弧线目标：${input.scenePlanning.arcGoal}` : null,
    input.scenePlanning?.setupPayoff ? `本场埋设/回收：${input.scenePlanning.setupPayoff}` : null,
    input.scenePlanning?.requiredMotif ? `本场必须出现的物件/空间/动作：${input.scenePlanning.requiredMotif}` : null,
  ].filter(Boolean);
  const devContext = formatDevelopmentContext({
    report: input.developmentReport,
    bible: input.storyBible,
    maxChars: 5000,
  });

  if (!planningParts.length && !devContext) return '';

  return [
    '# 开发约束',
    planningParts.join('\n'),
    devContext,
    '以上内容是导演约束：必须落实不可改事实、角色行为规则、物件/空间母题和本场埋设/回收，不要让角色直接讲主题。',
  ].filter(Boolean).join('\n\n');
}
