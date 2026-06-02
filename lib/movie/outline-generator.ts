import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { DevelopmentReport, StoryBible, StoryProposal, SceneOutlineItem } from './types';
import { formatDevelopmentContext } from './development';

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
5. **act**：第一幕/第二幕/第三幕
6. **arcName**：所属叙事弧线名
7. **arcGoal**：本场服务的弧线目标
8. **setupPayoff**：本场埋设或回收的承诺/伏笔
9. **requiredMotif**：本场必须出现的物件、空间、动作或视觉母题

生成 8-15 个场景。第一幕：铺垫（2-4场）。第二幕：冲突（4-8场）。第三幕：解决（2-4场）。

严格要求：
- 所有描述必须使用中文
- title 中的地点使用中文（如"办公室"、"医院"、"公园"），不要用英文
- 每个场景的 contentSummary 必须具体、有冲突、有推进，不要写空泛的描述
- 每个场景的 emotionalGoal 必须不同，避免重复

只输出合法的 JSON 数组。不要 markdown，不要解释。
格式: [{"title":"...","contentSummary":"...","emotionalGoal":"...","characterIds":["id1","id2"],"act":"第一幕","arcName":"...","arcGoal":"...","setupPayoff":"...","requiredMotif":"..."}, ...]

重要：只使用输入中的角色 ID，不要自己发明 ID。`;

const FOUR_PART_PROMPT = `你是一位专业编剧。根据故事和角色，生成“序 / 破 / 急 / 终”四场结构的短片场景大纲。

必须严格生成 4 个场景，不能多也不能少：
1. 序：建立人物、处境、世界规则和核心诱因。
2. 破：打破原有平衡，让人物目标和关系发生实质冲突。
3. 急：冲突升级到不可回避，人物必须付出代价或做出选择。
4. 终：完成情感落点和主题回响，给出明确但不过度解释的收束。

每个场景必须包含：
1. **title**：场景标题，使用 "INT./EXT. 地点 - 时间" 格式（如 "INT. 办公室 - 日"）。地点和时间使用中文。
2. **contentSummary**：2-4句中文描述，说明本场发生什么。
3. **emotionalGoal**：本场的情感转折点或关键情绪。
4. **characterIds**：出现在本场的角色 ID 数组（必须使用输入中提供的 EXACT ID）。
5. **act**：只能依次填写 "序"、"破"、"急"、"终"。
6. **arcName**：所属叙事弧线名。
7. **arcGoal**：本场服务的弧线目标。
8. **setupPayoff**：本场埋设或回收的承诺/伏笔。
9. **requiredMotif**：本场必须出现的物件、空间、动作或视觉母题。

严格要求：
- 只输出 4 个 JSON 数组元素，顺序必须是序、破、急、终。
- 所有描述必须使用中文。
- title 中的地点使用中文（如"办公室"、"医院"、"公园"），不要用英文。
- 每个场景的 contentSummary 必须具体、有冲突、有推进，不要写空泛的描述。
- 四个场景的 emotionalGoal 必须形成递进，不要重复。

只输出合法的 JSON 数组。不要 markdown，不要解释。
格式: [{"title":"...","contentSummary":"...","emotionalGoal":"...","characterIds":["id1","id2"],"act":"序","arcName":"...","arcGoal":"...","setupPayoff":"...","requiredMotif":"..."}, ...]

重要：只使用输入中的角色 ID，不要自己发明 ID。`;

export async function generateSceneOutline(
  proposal: StoryProposal,
  characters: CharacterForOutline[],
  development?: {
    report?: DevelopmentReport | null;
    bible?: StoryBible | null;
    useFourPartStructure?: boolean;
  }
): Promise<SceneOutlineItem[]> {
  const charList = characters.map(c => `- ${c.id}: ${c.name}`).join('\n');
  const context = `Story: ${proposal.oneLiner}
Synopsis: ${proposal.synopsis}

Characters (use these exact IDs):
${charList}

${formatDevelopmentContext({
  report: development?.report,
  bible: development?.bible,
  maxChars: 7000,
})}

请优先服从“故事圣经/开发读本”里的弧线、伏笔、物件母题和不可破坏规则。
${development?.useFourPartStructure ? '本次必须使用“序 / 破 / 急 / 终”四场结构，只生成 4 场。' : '本次使用默认三幕结构，生成 8-15 场。'}`;

  const messages: LLMMessage[] = [
    { role: 'system', content: development?.useFourPartStructure ? FOUR_PART_PROMPT : PROMPT },
    { role: 'user', content: context },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.7, maxTokens: 8192 });
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as SceneOutlineItem[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('LLM did not return valid scene outline');
  }
  if (development?.useFourPartStructure && parsed.length < 4) {
    throw new Error('LLM did not return four scenes for 序 / 破 / 急 / 终 outline');
  }

  // Validate character IDs
  const validIds = new Set(characters.map(c => c.id));
  const fourPartActs = ['序', '破', '急', '终'];
  const items = development?.useFourPartStructure ? parsed.slice(0, 4) : parsed;
  return items.map((item, i) => {
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
      act: development?.useFourPartStructure ? fourPartActs[i] : String((item as any).act ?? ''),
      arcName: String((item as any).arcName ?? ''),
      arcGoal: String((item as any).arcGoal ?? ''),
      setupPayoff: String((item as any).setupPayoff ?? ''),
      requiredMotif: String((item as any).requiredMotif ?? ''),
    };
  });
}
