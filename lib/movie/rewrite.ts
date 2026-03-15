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
      content: `You are a professional screenwriter. Rewrite the given scene according to the user's feedback. Keep the same structure (slug line, action, dialogue format) but apply the requested changes. 所有旁白、场景描述、动作说明、角色对话统一使用中文。Output only the revised screenplay text — no markdown, no explanation.`,
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

Revised script:`,
    },
  ];

  const result = await chatCompletion(messages, { temperature: 0.6, maxTokens: 4096 });
  return result.trim();
}
