import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';

export interface NovelReviewInput {
  movieTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterContent: string;
  developmentContext?: string;
  characters: Array<{
    name: string;
    personalityTraits?: string;
    signatureLanguageStyle?: string;
  }>;
}

export interface NovelReviewResult {
  passed: boolean;
  score: number;
  summary: string;
  issues: string[];
  rewriteInstructions: string;
}

/**
 * Review a novel chapter for quality.
 */
export async function reviewNovelChapter(
  input: NovelReviewInput
): Promise<NovelReviewResult> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        '你是一位资深番茄小说编辑和文学评论家，负责在小说发布前做质量门禁。',
        '你的标准很高：叙事要流畅自然，对话要生动有个性，情感要真实能引起共鸣。',
        '请只输出 JSON，不要 markdown，不要解释 JSON 之外的内容。',
      ].join('\n'),
    },
    { role: 'user', content: buildReviewPrompt(input) },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.2, maxTokens: 4096 });
  return parseReview(raw);
}

function buildReviewPrompt(input: NovelReviewInput): string {
  const characterText = input.characters
    .map(c => {
      const details = [`角色: ${c.name}`];
      if (c.personalityTraits) details.push(`性格: ${c.personalityTraits}`);
      if (c.signatureLanguageStyle) details.push(`语言风格: ${c.signatureLanguageStyle}`);
      return details.join('，');
    })
    .join('\n');

  return `请评审下面这个小说章节是否可以发布到番茄小说平台。

# 电影
${input.movieTitle}

# 章节
第${input.chapterNumber}章 ${input.chapterTitle}

${input.developmentContext?.trim() ? `# 开发约束 / 故事圣经\n${input.developmentContext.trim()}\n` : ''}

# 角色
${characterText}

# 章节内容
${input.chapterContent}

# 评审标准
1. **叙事流畅性**：行文是否自然流畅，不是剧本翻译腔？视角是否一致？
2. **对话质量**：对话是否符合角色性格，有口语感，不是书面化的演讲？
3. **情感表达**：情感描写是否真实细腻，能引起读者共鸣？
4. **章节结构**：是否有明确的开头、发展、高潮/转折？结尾是否有钩子？
5. **语言质量**：是否有AI腔、元叙事词汇、抽象空洞的描写？
6. **番茄小说适配**：节奏是否紧凑？是否有吸引读者继续阅读的悬念？
7. **反重复检查**（重点）：
   - 是否有重复的动作描写？（如"手指颤抖"、"指尖冰凉"、"指节泛白"在多处出现）
   - 是否有重复的句式？（如连续多段用相同句式开头）
   - 是否有重复的场景描写？（如同一事件被多次详细描述）
   - 是否有重复的意象？（如"咖啡凉了"、"高跟鞋敲击"在多处出现）
8. **角色名一致性**：同一角色是否在全章使用同一个名字？是否有英文名混入？
9. **开发约束落实**：是否保留不可改事实、角色行为规则、物件/空间母题和本章埋设/回收？是否没有把这些设计直白解释给读者？

# 输出 JSON 格式
{
  "passed": true,
  "score": 8,
  "summary": "一句话总体评价",
  "issues": ["具体问题1", "具体问题2"],
  "rewriteInstructions": "如果不通过，给下一版生成用的具体修改指令；如果通过，写通过原因。"
}

通过阈值：score >= 7 且没有严重问题。`;
}

function parseReview(raw: string): NovelReviewResult {
  const jsonText = extractJson(raw);
  try {
    const parsed = JSON.parse(jsonText) as Partial<NovelReviewResult>;
    const score = Number(parsed.score ?? 0);
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i): i is string => typeof i === 'string')
      : [];
    const passed = Boolean(parsed.passed) && score >= 7;

    return {
      passed,
      score,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      issues,
      rewriteInstructions: typeof parsed.rewriteInstructions === 'string'
        ? parsed.rewriteInstructions
        : issues.join('\n'),
    };
  } catch {
    return {
      passed: false,
      score: 0,
      summary: '评审模型返回内容无法解析为 JSON。',
      issues: [`无法解析评审结果: ${raw.substring(0, 500)}`],
      rewriteInstructions: '上一版评审结果格式异常。请重新生成。',
    };
  }
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }
  return raw.trim();
}

/**
 * Repair a failed novel chapter.
 */
export async function repairNovelChapter(
  input: NovelReviewInput,
  review: NovelReviewResult
): Promise<string> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        '你是一位资深网络小说作家和编辑，专门把不合格的章节修改成可发布的高质量小说。',
        '你可以大胆删减、重排、压缩、改写内容，但必须保留核心情节、角色关系和情感走向。',
        '只输出修复后的完整章节内容，不要 markdown，不要解释。',
      ].join('\n'),
    },
    { role: 'user', content: buildRepairPrompt(input, review) },
  ];

  const result = await chatCompletion(messages, { temperature: 0.55, maxTokens: 8192 });
  return result.trim();
}

function buildRepairPrompt(input: NovelReviewInput, review: NovelReviewResult): string {
  const characterText = input.characters
    .map(c => {
      const details = [`角色: ${c.name}`];
      if (c.personalityTraits) details.push(`性格: ${c.personalityTraits}`);
      if (c.signatureLanguageStyle) details.push(`语言风格: ${c.signatureLanguageStyle}`);
      return details.join('，');
    })
    .join('\n');

  return `请把下面这个未通过评审的小说章节修改成可发布的高质量版本。

# 电影
${input.movieTitle}

# 章节
第${input.chapterNumber}章 ${input.chapterTitle}

${input.developmentContext?.trim() ? `# 开发约束 / 故事圣经\n${input.developmentContext.trim()}\n` : ''}

# 角色
${characterText}

# 上一版章节内容
${input.chapterContent}

# 评审结果
评分: ${review.score}/10
总体评价: ${review.summary || '无'}
问题:
${review.issues.length ? review.issues.map(i => `- ${i}`).join('\n') : '- 未列出具体问题'}
修复指令:
${review.rewriteInstructions || '提升叙事质量和情感表达。'}

# 修复要求
1. 保留核心情节和角色关系，但可以大幅改写表达方式
2. 对话要生动自然，符合角色性格
3. 叙事要流畅，不是剧本翻译腔
4. 情感描写要细腻真实，能引起共鸣
5. 章节结尾要有钩子，吸引读者继续阅读
6. 所有内容使用中文，不要夹杂英文
7. 不要出现元叙事词汇：场景、剧情、角色、台词、观众、AI、剧本
8. 章节长度 2000-3000 字

直接输出修复后的完整章节内容，不要 markdown，不要解释。`;
}
