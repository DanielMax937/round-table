import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { CharacterState } from './types';

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

  const fullScript = await chatCompletion(messages, { temperature: 0.8, maxTokens: 4096 });
  return { fullScript: fullScript.trim() };
}

function buildDirectorPrompt(input: DirectorActorInput): string {
  let p = `You are a professional film director and screenwriter. Write ONE complete scene in standard screenplay format.

# Movie
${input.movieTitle}

# Scene
**${input.sceneHeading}**
${input.contentSummary}

# Emotional Goal
${input.emotionalGoal}

# Story So Far (Plot Summary)
${input.plotSummary || '(Beginning of story)'}

# Characters in This Scene
`;
  for (const c of input.characters) {
    const state = parseCharacterState(c.currentStateJson);
    p += `\n## ${c.name}\n`;
    p += `- Backstory: ${c.backstory.substring(0, 150)}${c.backstory.length > 150 ? '...' : ''}\n`;
    p += `- Personality: ${c.personalityTraits}\n`;
    if (c.surfaceGoal) p += `- Surface goal: ${c.surfaceGoal}\n`;
    if (c.deepMotivation) p += `- Deep motivation: ${c.deepMotivation}\n`;
    if (c.fatalFlaw) p += `- Fatal flaw: ${c.fatalFlaw}\n`;
    if (c.signatureLanguageStyle) p += `- Speech style: ${c.signatureLanguageStyle}\n`;
    if (state) {
      if (state.emotionalState) p += `- Current emotional state: ${state.emotionalState}\n`;
      if (state.physicalState) p += `- Current physical state: ${state.physicalState}\n`;
      if (state.knowledge?.length) p += `- Knowledge: ${state.knowledge.join('; ')}\n`;
    }
  }

  p += `

# Instructions
1. Start with a slug line (INT./EXT. LOCATION - TIME)
2. Add brief action/description
3. Format dialogue: CHARACTER NAME in caps, optional (parentheticals), then dialogue
4. Add action beats between dialogue
5. Achieve the emotional goal of this scene
6. Keep each character's voice and personality
7. Output clean screenplay text — no markdown, no code blocks
8. End when the scene's conflict/beat is complete (typically 1-3 pages)
9. **Language**: 所有旁白、场景描述、动作说明、角色对话统一使用中文。`;
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
  const result = await chatCompletion(messages, { temperature: 0.7, maxTokens: 800 });
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

# 本场角色
`;
  for (const c of input.characters) {
    p += `- ${c.name}：${c.personalityTraits}${c.surfaceGoal ? `，本场目标：${c.surfaceGoal}` : ''}\n`;
  }

  p += `

# 输出要求
请用中文写一段「场景概要」（200-400字），包含：
1. **场景大概内容**：这一场发生了什么、主要冲突或看点
2. **每个人的大概表现**：每个角色在本场的态度、情绪、行为倾向（各1-2句）

直接输出概要文本，不要用 markdown 标题，不要写「场景概要：」等前缀。`;
  return p;
}
