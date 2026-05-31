import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { StoryProposal, SceneOutlineItem } from './types';

interface CharacterForOutline {
  id: string;
  name: string;
}

const PROMPT = `你是一位专业编剧。根据故事和角色，生成三幕结构的场景大纲。

每个场景必须包含：
1. **title**：场景标题，使用 "INT./EXT. 地点 - 时间" 格式（如 "INT. 办公室 - 日"）。地点和时间使用中文。
2. **contentSummary**：2-4句中文描述，说明本场发生什么
3. **emotionalGoal**：本场的情感转折点或关键情绪
4. **characterIds**：出现在本场的角色 ID 数组（必须使用输入中提供的 EXACT ID）

生成 8-15 个场景。第一幕：铺垫（2-4场）。第二幕：冲突（4-8场）。第三幕：解决（2-4场）。

严格要求：
- 所有描述必须使用中文
- title 中的地点使用中文（如"办公室"、"医院"、"公园"），不要用英文
- 每个场景的 contentSummary 必须具体、有冲突、有推进，不要写空泛的描述
- 每个场景的 emotionalGoal 必须不同，避免重复

只输出合法的 JSON 数组。不要 markdown，不要解释。
格式: [{"title":"...","contentSummary":"...","emotionalGoal":"...","characterIds":["id1","id2"]}, ...]

重要：只使用输入中的角色 ID，不要自己发明 ID。`;

export async function generateSceneOutline(
  proposal: StoryProposal,
  characters: CharacterForOutline[]
): Promise<SceneOutlineItem[]> {
  const charList = characters.map(c => `- ${c.id}: ${c.name}`).join('\n');
  const context = `Story: ${proposal.oneLiner}
Synopsis: ${proposal.synopsis}

Characters (use these exact IDs):
${charList}`;

  const messages: LLMMessage[] = [
    { role: 'system', content: PROMPT },
    { role: 'user', content: context },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.7, maxTokens: 8192 });
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as SceneOutlineItem[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('LLM did not return valid scene outline');
  }

  // Validate character IDs
  const validIds = new Set(characters.map(c => c.id));
  return parsed.map((item, i) => {
    const ids = Array.isArray(item.characterIds) ? item.characterIds : [];
    const validCharacterIds = ids.filter((id: string) => validIds.has(id));
    if (validCharacterIds.length === 0 && characters.length > 0) {
      validCharacterIds.push(characters[0].id);
    }
    return {
      title: String(item.title ?? `Scene ${i + 1}`),
      contentSummary: String(item.contentSummary ?? ''),
      emotionalGoal: String(item.emotionalGoal ?? ''),
      characterIds: validCharacterIds,
    };
  });
}
