import OpenAI from 'openai';
import type { LLMMessage } from '@/lib/llm/types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  Object.keys(envConfig).forEach((key) => {
    process.env[key] = envConfig[key];
  });
}

export interface SceneScriptReviewInput {
  movieTitle: string;
  sceneHeading: string;
  sceneDescription: string;
  emotionalGoal: string;
  characters: Array<{
    name: string;
    backstory: string;
    personalityTraits?: string | null;
    surfaceGoal?: string | null;
    deepMotivation?: string | null;
    fatalFlaw?: string | null;
    signatureLanguageStyle?: string | null;
  }>;
  rawDialogue: Array<{
    roundNumber: number;
    characterName: string;
    content: string;
  }>;
  script: string;
  attempt: number;
}

export interface SceneScriptReviewResult {
  passed: boolean;
  score: number;
  aiFeel: 'low' | 'medium' | 'high';
  summary: string;
  issues: string[];
  rewriteInstructions: string;
}

export async function repairSceneScript(
  input: SceneScriptReviewInput,
  review: SceneScriptReviewResult
): Promise<string> {
  const config = getReviewerConfig();
  const client = createReviewerClient();
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        '你是资深好莱坞剧本医生，专门把不合格的即兴角色对话修成可交给人类评审的电影剧本。',
        '你可以大胆删减、重排、压缩、改写台词，但必须保留场景目标、角色事实、人物关系和戏剧走向。',
        '你的修复目标不是润色文字，而是让每句台词都像人物在压力下的即时行为。',
        '只输出修复后的完整剧本文本，不要 markdown，不要解释，不要输出评审意见。',
      ].join('\n'),
    },
    { role: 'user', content: buildRepairPrompt(input, review) },
  ];

  const response = await client.chat.completions.create({
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })) as any,
    temperature: 0.55,
    max_tokens: 4096,
  });

  return (response.choices[0]?.message?.content || '').trim();
}

function getReviewerConfig(): { apiKey: string; baseURL: string; model: string } {
  const apiKey = process.env.ARK_API_KEY || '';
  const baseURL = process.env.ARK_BASE_URL || '';
  const model = process.env.DOUBAO_VISION_MODEL || '';

  if (!apiKey) {
    throw new Error('ARK_API_KEY not configured for scene script review');
  }
  if (!baseURL) {
    throw new Error('ARK_BASE_URL not configured for scene script review');
  }
  if (!model) {
    throw new Error('DOUBAO_VISION_MODEL not configured for scene script review');
  }

  return { apiKey, baseURL, model };
}

function createReviewerClient(): OpenAI {
  const config = getReviewerConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

export async function reviewSceneScript(
  input: SceneScriptReviewInput
): Promise<SceneScriptReviewResult> {
  const config = getReviewerConfig();
  const client = createReviewerClient();
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        '你是资深好莱坞编剧、剧本医生和表演指导，负责在剧本发给人类评审前做质量门禁。',
        '你的标准很高：人物要像真人，有欲望、压力、潜台词和即时反应；对话不能有 AI 味、复读、主题说教、泛泛鸡汤、角色串味或脱离处境。',
        '原始 agent 对话只作为诊断参考；是否通过必须以“合成剧本”最终呈现给人类时的质量为准。',
        '请只输出 JSON，不要 markdown，不要解释 JSON 之外的内容。',
      ].join('\n'),
    },
    { role: 'user', content: buildReviewPrompt(input) },
  ];

  const response = await client.chat.completions.create({
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })) as any,
    temperature: 0.2,
    max_tokens: 1600,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  return parseReview(raw);
}

function buildReviewPrompt(input: SceneScriptReviewInput): string {
  const characterText = input.characters
    .map((c) => {
      const details = [
        `角色: ${c.name}`,
        `背景: ${truncate(c.backstory, 220)}`,
        c.personalityTraits ? `性格: ${c.personalityTraits}` : null,
        c.surfaceGoal ? `长期目标/压力: ${c.surfaceGoal}` : null,
        c.deepMotivation ? `深层动机: ${c.deepMotivation}` : null,
        c.fatalFlaw ? `缺陷: ${c.fatalFlaw}` : null,
        c.signatureLanguageStyle ? `语言风格: ${c.signatureLanguageStyle}` : null,
      ].filter(Boolean);
      return details.join('\n');
    })
    .join('\n\n');

  const dialogueText = input.rawDialogue
    .map((m) => `Round ${m.roundNumber} / ${m.characterName}: ${m.content}`)
    .join('\n');

  return `请评审下面这场戏是否可以发给人类评审。

# 电影
${input.movieTitle}

# 场景
${input.sceneHeading}
${input.sceneDescription}

# 情感目标
${input.emotionalGoal || '(未填写)'}

# 角色档案
${characterText}

# 原始 agent 对话（诊断参考，不是最终交付文本）
${dialogueText}

# 合成剧本
${input.script}

# 评审标准
1. 对话是否像真人在当前处境下说话，而不是 AI 总结、互相解释主题或泛泛说教。
2. 是否有跨轮重复、同义复读、绕着同一个观点空转。
3. 角色声音、经历、欲望、缺陷和处境是否匹配，有没有角色串味。
4. 是否有清楚的戏剧推进：开场反应、冲突/信息/选择、收束或转折。
5. 是否存在元叙事、英文夹杂、模板化比喻、过于工整的问答感。

# 输出 JSON 格式
{
  "passed": true,
  "score": 8,
  "aiFeel": "low",
  "summary": "一句话总体评价",
  "issues": ["具体问题1", "具体问题2"],
  "rewriteInstructions": "如果不通过，给下一版生成用的具体修改指令；如果通过，写通过原因。"
}

通过阈值：score >= 8 且 aiFeel 不是 high，且没有严重复读、角色串味或脱离场景。`;
}

function buildRepairPrompt(input: SceneScriptReviewInput, review: SceneScriptReviewResult): string {
  const characterText = input.characters
    .map((c) => {
      const details = [
        `角色: ${c.name}`,
        `背景: ${truncate(c.backstory, 260)}`,
        c.personalityTraits ? `性格: ${c.personalityTraits}` : null,
        c.surfaceGoal ? `长期目标/压力: ${c.surfaceGoal}` : null,
        c.deepMotivation ? `深层动机: ${c.deepMotivation}` : null,
        c.fatalFlaw ? `缺陷: ${c.fatalFlaw}` : null,
        c.signatureLanguageStyle ? `语言风格: ${c.signatureLanguageStyle}` : null,
      ].filter(Boolean);
      return details.join('\n');
    })
    .join('\n\n');

  const dialogueText = input.rawDialogue
    .map((m) => `Round ${m.roundNumber} / ${m.characterName}: ${m.content}`)
    .join('\n');

  return `请把下面这场未通过评审的戏修成可发给人类评审的最终剧本。

# 电影
${input.movieTitle}

# 场景
${input.sceneHeading}
${input.sceneDescription}

# 情感目标
${input.emotionalGoal || '(未填写)'}

# 角色档案
${characterText}

# 原始 agent 即兴素材
${dialogueText}

# 上一版合成剧本
${input.script}

# 资深编剧评审结果（必须逐条修正）
评分: ${review.score}/10
AI 感: ${review.aiFeel}
总体评价: ${review.summary || '无'}
问题:
${review.issues.length ? review.issues.map((i) => `- ${i}`).join('\n') : '- 未列出具体问题'}
修复指令:
${review.rewriteInstructions || '减少 AI 感、复读和角色串味。'}

# 修复要求
1. 输出完整 screenplay：场景标题、动作/场面描述、角色名、台词。
2. 台词必须像真人在当前处境下的即时反应，有潜台词、犹豫、打断、回避、升级或让步；每句台词都要改变对方处境。
3. 删除 AI 总结腔、互相解释主题、泛泛说教、陈旧比喻、鸡汤金句、角色串味和重复观点。
4. 每个角色只说自己会说的话；保留他们的背景、欲望、缺陷、压力和语言风格。
5. 允许大幅改写原始素材，但不能改变本场基本事件、关系和情感目标。
6. 所有旁白、动作说明、角色对话统一使用中文；不要夹英文单词。
7. 不要出现“场景、剧情、角色、台词、观众、AI”等元叙事词，除非故事世界内自然需要。
8. 不要让角色直接说出自己的心理分析、价值观总结或人生道理；用动作、停顿、错位回答和具体细节表达。
9. 让冲突具体化到眼前的人、物、钱、身份、动作、座位、表情、手机、杯子、账单、衣服、旧事或风险。
10. 输出前自查：如果某句话可以被任何角色说、像项目汇报、像辩论赛、像金句，就删除或改成更短更刺的反应。
11. 只输出修复后的剧本文本，不要 markdown，不要解释。`;
}

function parseReview(raw: string): SceneScriptReviewResult {
  const jsonText = extractJson(raw);
  try {
    const parsed = JSON.parse(jsonText) as Partial<SceneScriptReviewResult>;
    const score = Number(parsed.score ?? 0);
    const aiFeel = parsed.aiFeel === 'low' || parsed.aiFeel === 'medium' || parsed.aiFeel === 'high'
      ? parsed.aiFeel
      : 'high';
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i): i is string => typeof i === 'string')
      : [];
    const passed = Boolean(parsed.passed) && score >= 8 && aiFeel !== 'high';

    return {
      passed,
      score,
      aiFeel,
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
      aiFeel: 'high',
      summary: '评审模型返回内容无法解析为 JSON。',
      issues: [`无法解析评审结果: ${truncate(raw, 500)}`],
      rewriteInstructions: '上一版评审结果格式异常。请重生成时更严格避免 AI 感、复读和角色串味。',
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

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
