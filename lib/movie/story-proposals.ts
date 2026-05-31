import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { StoryProposal } from './types';

const PROMPT = `你是一位专业的编剧和故事策划。根据电影主题，生成3个不同的故事概念提案。

每个提案必须包含：
1. **oneLiner**：一句话故事梗概（25字以内中文）
2. **coreConflict**：核心戏剧冲突
3. **styleReference**：1-2个风格参考（如"《寄生虫》遇上《你好，李焕英》"）
4. **synopsis**：3-5句故事大纲（起承转合）

严格要求：
- 所有内容必须使用中文，不要夹杂英文
- 提到的角色名必须是中文名（不要用英文名或拼音）
- styleReference 中引用的电影/作品可以用中文名

只输出合法的 JSON 数组，恰好3个对象。不要 markdown，不要解释。
格式: [{"oneLiner":"...","coreConflict":"...","styleReference":"...","synopsis":"..."}, ...]`;

export async function generateStoryProposals(theme: string): Promise<StoryProposal[]> {
  const messages: LLMMessage[] = [
    { role: 'system', content: PROMPT },
    { role: 'user', content: `Theme: ${theme}` },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.9, maxTokens: 8192 });
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as StoryProposal[];

  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error('LLM did not return 3 valid story proposals');
  }

  return parsed.slice(0, 3).map(p => ({
    oneLiner: String(p.oneLiner ?? ''),
    coreConflict: String(p.coreConflict ?? ''),
    styleReference: String(p.styleReference ?? ''),
    synopsis: String(p.synopsis ?? ''),
  }));
}
