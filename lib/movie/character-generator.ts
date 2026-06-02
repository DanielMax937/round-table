import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { StoryBible, DevelopmentReport, StoryProposal, CharacterProfile } from './types';
import { formatDevelopmentContext } from './development';

const PROMPT = `你是一位专业的编剧。根据已确认的故事提案，生成3-6个核心角色档案。

每个角色必须包含：
1. **name**：中文全名（必须是地道的中文姓名，如"林宛"、"陈素芬"，不要用英文名、拼音或外国人名）
2. **surfaceGoal**：表面目标（具体的、与剧情相关的）
3. **deepMotivation**：深层动机（内心的伤痛或需求）
4. **fatalFlaw**：致命缺陷（导致冲突或失败的性格弱点）
5. **signatureLanguageStyle**：语言风格（说话习惯、口头禅、用词特点）
6. **backstory**：2-4句背景故事
7. **personalityTraits**：3-5个性格特征，逗号分隔

严格要求：
- 所有内容必须使用中文
- 角色名必须是纯中文，不要出现英文
- 每个角色的语言风格必须有明显差异，避免同质化
- 性格特征要具体，不要用"善良、勇敢"这类空泛词汇

只输出合法的 JSON 数组。不要 markdown，不要解释。
格式: [{"name":"...","surfaceGoal":"...","deepMotivation":"...","fatalFlaw":"...","signatureLanguageStyle":"...","backstory":"...","personalityTraits":"..."}, ...]`;

export async function generateCharactersFromStory(
  proposal: StoryProposal,
  development?: {
    report?: DevelopmentReport | null;
    bible?: StoryBible | null;
  }
): Promise<CharacterProfile[]> {
  const context = `Story: ${proposal.oneLiner}
Conflict: ${proposal.coreConflict}
Style: ${proposal.styleReference}
Synopsis: ${proposal.synopsis}

${formatDevelopmentContext({
  report: development?.report,
  bible: development?.bible,
  maxChars: 5000,
})}`;

  const messages: LLMMessage[] = [
    { role: 'system', content: PROMPT },
    { role: 'user', content: context },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.8, maxTokens: 8192 });
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as CharacterProfile[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('LLM did not return valid character profiles');
  }

  return parsed.map(p => ({
    name: String(p.name ?? 'Unknown'),
    surfaceGoal: String(p.surfaceGoal ?? ''),
    deepMotivation: String(p.deepMotivation ?? ''),
    fatalFlaw: String(p.fatalFlaw ?? ''),
    signatureLanguageStyle: String(p.signatureLanguageStyle ?? ''),
    backstory: String(p.backstory ?? ''),
    personalityTraits: String(p.personalityTraits ?? ''),
  }));
}
