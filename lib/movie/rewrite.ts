import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';

export async function rewriteSceneWithFeedback(
  currentScript: string,
  feedback: string,
  sceneContext: { movieTitle: string; sceneHeading: string }
): Promise<string> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        '你是资深剧本医生，负责把 AI 味重、说教、复读、角色串味的场景改成可给普通影视行业人继续工作的剧本。',
        '不要做表面润色。你必须重建冲突、删掉重复观点、压缩台词、用动作和具体物件承载潜台词。',
        '保留场景标题、人物关系和基本事件，但允许大幅改写台词、动作、节奏和收束。',
        '所有旁白、场景描述、动作说明、角色对话统一使用中文。',
        '只输出修订后的完整剧本文本，不要 markdown，不要解释。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `Movie: ${sceneContext.movieTitle}
Scene: ${sceneContext.sceneHeading}

Current script:
---
${currentScript}
---

User feedback: ${feedback}

Hard quality requirements:
1. 删除任何泛泛说理、鸡汤、主题总结和“金钱买不来爱”式复读。
2. 每句台词都必须是当前压力下的行为：防御、刺探、转移、威胁、让步、误读、撒谎、打断、提出具体要求。
3. 每 3-5 句台词加入一个改变关系压力的动作 beat，动作必须绑定办公室内具体物件、电话、文件、账单、屏幕、门、杯子或时间压力。
4. 角色不能直接解释心理；用回避、手上动作、错误回答、短句和沉默表达。
5. 如果某句台词换成任何角色都能说，删掉或改成只有这个角色会说的话。
6. 总体控制在 900-1500 字；宁可少而有力，不要完整辩论。

Revised script:`,
    },
  ];

  const result = await chatCompletion(messages, { temperature: 0.6, maxTokens: 4096 });
  return result.trim();
}
