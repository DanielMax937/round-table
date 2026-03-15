import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { StoryProposal } from './types';

const PROMPT = `You are a professional screenwriter and story developer. Given a movie theme, generate exactly 3 distinct story concept proposals.

For each proposal, provide:
1. **oneLiner**: A compelling one-sentence logline (25 words or less)
2. **coreConflict**: The central dramatic conflict that drives the story
3. **styleReference**: 1-2 film references for tone/style (e.g. "Blade Runner meets Inception")
4. **synopsis**: A 3-5 sentence story synopsis (setup, development, stakes)

Output ONLY valid JSON array with exactly 3 objects. No markdown, no explanation.
Format: [{"oneLiner":"...","coreConflict":"...","styleReference":"...","synopsis":"..."}, ...]`;

export async function generateStoryProposals(theme: string): Promise<StoryProposal[]> {
  const messages: LLMMessage[] = [
    { role: 'system', content: PROMPT },
    { role: 'user', content: `Theme: ${theme}` },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.9, maxTokens: 2048 });
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
