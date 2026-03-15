import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { StoryProposal, SceneOutlineItem } from './types';

interface CharacterForOutline {
  id: string;
  name: string;
}

const PROMPT = `You are a professional screenwriter. Given a story and its characters, generate a scene outline following three-act structure.

For each scene provide:
1. **title**: Scene heading (e.g. "INT. WAREHOUSE - NIGHT")
2. **contentSummary**: 2-4 sentences describing what happens
3. **emotionalGoal**: The emotional turning point or beat for this scene
4. **characterIds**: Array of character IDs that appear in this scene (use EXACTLY the IDs provided in the character list)

Generate 8-15 scenes. Act 1: setup (2-4 scenes). Act 2: confrontation (4-8 scenes). Act 3: resolution (2-4 scenes).

Output ONLY valid JSON array. No markdown, no explanation.
Format: [{"title":"...","contentSummary":"...","emotionalGoal":"...","characterIds":["id1","id2"]}, ...]

IMPORTANT: Use ONLY the character IDs from the input. Do not invent IDs.`;

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

  const raw = await chatCompletion(messages, { temperature: 0.7, maxTokens: 4096 });
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
