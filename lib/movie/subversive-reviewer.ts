import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';

export interface SubversiveReviewInput {
  movieTitle: string;
  sceneHeading: string;
  sceneDescription: string;
  script: string;
  characters: Array<{
    name: string;
    personalityTraits?: string;
    fatalFlaw?: string;
  }>;
}

export interface SubversiveReviewResult {
  passed: boolean;
  score: number;
  surpriseLevel: 'predictable' | 'somewhat_unexpected' | 'genuinely_surprising';
  summary: string;
  issues: string[];
  suggestions: string[];
}

/**
 * "颠覆审查" - 检查剧本是否有意外转折、角色深度、反套路设计
 * 核心问题：观众能否预测到每一个情节走向？
 */
export async function reviewSubversive(
  input: SubversiveReviewInput
): Promise<SubversiveReviewResult> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        '你是一位专门做"颠覆审查"的剧本医生。你的工作不是检查语法或格式，而是回答一个核心问题：',
        '这部剧本有没有让观众意外的东西？',
        '',
        '你见过太多"安全"的剧本——每个情节都在预期之内，每个角色都符合设定，没有反叛，没有让观众不舒服的时刻。',
        '你需要找出这些问题，并提出具体的颠覆建议。',
        '',
        '请只输出 JSON，不要 markdown，不要解释 JSON 之外的内容。',
      ].join('\n'),
    },
    { role: 'user', content: buildSubversivePrompt(input) },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.3, maxTokens: 4096 });
  return parseSubversiveReview(raw);
}

function buildSubversivePrompt(input: SubversiveReviewInput): string {
  const characterText = input.characters
    .map(c => {
      const details = [`角色: ${c.name}`];
      if (c.personalityTraits) details.push(`性格: ${c.personalityTraits}`);
      if (c.fatalFlaw) details.push(`缺陷: ${c.fatalFlaw}`);
      return details.join('，');
    })
    .join('\n');

  return `请对下面这场戏做"颠覆审查"。

# 电影
${input.movieTitle}

# 场景
${input.sceneHeading}
${input.sceneDescription}

# 角色
${characterText}

# 剧本
${input.script}

# 审查维度

## 1. 可预测性检查
- 情节走向是否在观众预期之内？
- 有没有至少一个让观众"没想到"的瞬间？
- 角色的选择是否太"正确"、太"合理"，缺乏真实人性的复杂？

## 2. 角色深度检查
- 角色是否有矛盾？（表面目标 vs 深层动机）
- 角色是否有至少一个让观众不舒服的特质？
- 配角是否只是工具人？（只为推动主角情节存在）

## 3. 节奏与张力检查
- 是否有"填充感"的段落？（删掉不影响情节）
- 张力是否有起伏？（还是一直在一个水平线上）
- 对话是否有真正的冲突？（还是表面争执实际和谐）

## 4. 比喻与描写检查
- 是否有重复的比喻模式？（如每个动作都"像XX"）
- 描写是否过度？（读者是否会跳过某些段落）
- 是否有"AI腔"？（过于工整、对称、正确）

## 5. 意外元素检查
- 有没有一个角色做了观众没想到的事？
- 有没有一个细节在后面会产生意想不到的效果？
- 有没有一个"安静的炸弹"——读者暂时没意识到但后面会爆炸的信息？

# 输出 JSON 格式
{
  "passed": true,
  "score": 8,
  "surpriseLevel": "somewhat_unexpected",
  "summary": "一句话总体评价",
  "issues": ["具体问题1", "具体问题2"],
  "suggestions": ["颠覆建议1", "颠覆建议2"]
}

通过阈值：score >= 6 且 surpriseLevel 不是 "predictable"。`;
}

function parseSubversiveReview(raw: string): SubversiveReviewResult {
  const jsonText = extractJson(raw);
  try {
    const parsed = JSON.parse(jsonText) as Partial<SubversiveReviewResult>;
    const score = Number(parsed.score ?? 0);
    const surpriseLevel = parsed.surpriseLevel === 'genuinely_surprising' ||
      parsed.surpriseLevel === 'somewhat_unexpected'
      ? parsed.surpriseLevel
      : 'predictable';
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i): i is string => typeof i === 'string')
      : [];
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === 'string')
      : [];
    const passed = Boolean(parsed.passed) && score >= 6 && surpriseLevel !== 'predictable';

    return {
      passed,
      score,
      surpriseLevel,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      issues,
      suggestions,
    };
  } catch {
    return {
      passed: false,
      score: 0,
      surpriseLevel: 'predictable',
      summary: '颠覆审查模型返回内容无法解析为 JSON。',
      issues: [`无法解析审查结果: ${raw.substring(0, 500)}`],
      suggestions: ['请重新生成剧本。'],
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
