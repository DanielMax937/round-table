import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { DevelopmentReport, StoryBible } from './types';
import { formatDevelopmentContext } from './development';

export interface ScriptSynthesisInput {
  movieTitle: string;
  sceneHeading: string;
  sceneDescription: string;
  characters: Array<{ name: string; backstory: string }>;
  messages: Array<{ characterName: string; content: string; roundNumber: number }>;
  reviewFeedback?: string;
  developmentReport?: DevelopmentReport | null;
  storyBible?: StoryBible | null;
  scenePlanning?: {
    act?: string | null;
    arcName?: string | null;
    arcGoal?: string | null;
    setupPayoff?: string | null;
    requiredMotif?: string | null;
  } | null;
}

/**
 * Synthesize improvised dialogue into screenplay format.
 * Non-streaming: returns full content when complete.
 */
export async function synthesizeScript(
  input: ScriptSynthesisInput
): Promise<{ fullContent: string }> {
  if (!input.messages.length) {
    throw new Error('No dialogue to finalize');
  }

  const prompt = buildScriptPrompt(input);
  const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
  const fullContent = await chatCompletion(messages, { temperature: 0.7 });
  return { fullContent: fullContent.trim() };
}

function buildScriptPrompt(input: ScriptSynthesisInput): string {
  let prompt = `You are a senior script doctor for a commercial film/short-drama writers room. Turn rough improvised dialogue into a playable scene, not a polished essay.\n\n`;
  prompt += `**Movie:** ${input.movieTitle}\n`;
  prompt += `**Scene:** ${input.sceneHeading}\n`;
  prompt += `**Description:** ${input.sceneDescription}\n\n`;
  const planningContext = buildPlanningContext(input);
  if (planningContext) {
    prompt += `**Development Constraints:**\n${planningContext}\n\n`;
  }
  if (input.reviewFeedback?.trim()) {
    prompt += `**Mandatory Previous Review Feedback To Fix:**\n${input.reviewFeedback.trim()}\n\n`;
  }

  prompt += `**Characters:**\n`;
  for (const char of input.characters) {
    prompt += `- ${char.name}: ${char.backstory.substring(0, 100)}\n`;
  }

  prompt += `\n**Raw Improvised Dialogue:**\n\n`;

  let currentRound = 0;
  for (const msg of input.messages) {
    if (msg.roundNumber !== currentRound) {
      currentRound = msg.roundNumber;
      prompt += `--- Round ${currentRound} ---\n`;
    }
    prompt += `${msg.characterName}: ${msg.content}\n\n`;
  }

  prompt += `\n---\n\n`;
  prompt += `Rewrite this into proper screenplay format:\n`;
  prompt += `1. Start with a slug line (INT./EXT. LOCATION - TIME)\n`;
  prompt += `2. Add brief action/scene description\n`;
  prompt += `3. Format dialogue with CHARACTER NAME in caps, optional (parentheticals), and dialogue\n`;
  prompt += `4. Add natural action beats between dialogue where appropriate\n`;
  prompt += `5. Keep the essence and personality of each character's lines\n`;
  prompt += `6. You may condense, reorder, or polish lines for dramatic effect, and remove repeated or off-scene material\n`;
  prompt += `7. Keep human roughness: interruptions, short evasions, loaded politeness, misreadings, tactical silence, and reactions to objects or space`;
  prompt += `\n8. **Language**: 所有旁白、场景描述、动作说明、角色对话统一使用中文，不要夹英文单词。`;
  prompt += `\n9. 删除任何元叙事表达，例如“场景、剧情、戏剧化、角色、台词、观众”等，除非这些词是角色在故事世界内真实会说的话。`;
  prompt += `\n10. 如果原始即兴对话里有重复说理，把它合并成一次，并用新的动作或沉默承接。`;
  prompt += `\n11. 如果有上一版评审反馈，必须逐条修正；删除被点名的陈旧比喻、AI 腔、鸡汤式金句和角色串味。`;
  prompt += `\n12. 不要把角色台词润色成完整观点或演讲。宁可短、刺、含混，也不要工整、正确、总结。`;
  prompt += `\n13. 每 3-5 句台词之间加入一个会改变社交压力的动作 beat，例如停顿、看手机、挪椅子、递账单、关门、抢杯子、避开视线。`;
  prompt += `\n14. 替换“别闹了、坐下、继续、相信我、你不懂”等万能句；如果保留控制意图，必须改成带具体后果、物件、钱、时间、公开丢脸或行动压力的台词。`;
  prompt += `\n15. Cut ruthlessly. If the raw dialogue repeats the same idea, keep only the sharpest beat and replace the rest with action, interruption, or a practical decision.`;
  prompt += `\n16. Build a concrete situation around the scene: phone calls, calendar pressure, contract/file/bill/object in hand, someone waiting outside, a deadline, or a public consequence.`;
  prompt += `\n17. Avoid universal lesson lines such as “钱买不来爱/温暖/亲情”, “心里有她就好”, “别苛责自己”. If that meaning is needed, express it through a specific object or behavior.`;
  prompt += `\n18. Keep the final scene between 900 and 1600 Chinese characters unless the scene truly needs more.`;
  prompt += `\n19. Output clean screenplay text — no markdown headers or code blocks.`;
  prompt += `\n20. **角色名必须使用剧本中提供的中文名**，不要翻译成英文或使用拼音。如果剧本中有英文名，直接保留原样。`;
  prompt += `\n21. **禁止重复描写**：同一个场景内，不要重复使用相同的动作描写（如"手指颤抖"、"指尖冰凉"、"指节泛白"）。每个动作只出现一次，后续用完全不同的方式表达。`;
  prompt += `\n22. **场景标题格式统一**：使用 "INT./EXT. 地点 - 时间" 格式，不要混用 "内景"、"外景" 等中文格式。`;
  prompt += `\n23. 必须落实开发约束中的不可改事实、弧线目标、埋设/回收和物件/空间母题；不要让角色直接解释这些设计。`;

  return prompt;
}

function buildPlanningContext(input: ScriptSynthesisInput): string {
  const sceneParts = [
    input.scenePlanning?.act ? `幕/阶段：${input.scenePlanning.act}` : null,
    input.scenePlanning?.arcName ? `叙事弧线：${input.scenePlanning.arcName}` : null,
    input.scenePlanning?.arcGoal ? `弧线目标：${input.scenePlanning.arcGoal}` : null,
    input.scenePlanning?.setupPayoff ? `本场埋设/回收：${input.scenePlanning.setupPayoff}` : null,
    input.scenePlanning?.requiredMotif ? `必须出现的物件/空间/动作：${input.scenePlanning.requiredMotif}` : null,
  ].filter(Boolean);
  const devContext = formatDevelopmentContext({
    report: input.developmentReport,
    bible: input.storyBible,
    maxChars: 4000,
  });
  return [sceneParts.join('\n'), devContext].filter(Boolean).join('\n\n');
}
