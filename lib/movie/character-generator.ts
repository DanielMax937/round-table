import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { StoryProposal, CharacterProfile } from './types';

const PROMPT = `You are a professional screenwriter. Given a confirmed story proposal, generate 3-6 core character profiles that will drive the narrative.

For each character provide:
1. **name**: Full character name
2. **surfaceGoal**: What they outwardly want (concrete, plot-related)
3. **deepMotivation**: Inner need or wound driving them
4. **fatalFlaw**: Weakness that creates conflict or downfall
5. **signatureLanguageStyle**: How they speak (vocabulary, rhythm, verbal tics)
6. **backstory**: 2-4 sentences of background relevant to the story
7. **personalityTraits**: 3-5 comma-separated traits (e.g. "cunning, paranoid, loyal")

Output ONLY valid JSON array. No markdown, no explanation.
Format: [{"name":"...","surfaceGoal":"...","deepMotivation":"...","fatalFlaw":"...","signatureLanguageStyle":"...","backstory":"...","personalityTraits":"..."}, ...]`;

export async function generateCharactersFromStory(
  proposal: StoryProposal
): Promise<CharacterProfile[]> {
  const context = `Story: ${proposal.oneLiner}
Conflict: ${proposal.coreConflict}
Style: ${proposal.styleReference}
Synopsis: ${proposal.synopsis}`;

  const messages: LLMMessage[] = [
    { role: 'system', content: PROMPT },
    { role: 'user', content: context },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.8, maxTokens: 2048 });
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as CharacterProfile[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('LLM did not return valid character profiles');
  }

  return parsed.map(p => ({
    name: String(p.name ?? 'Unknown'),
    surfaceGoal: String(p.surfaceGoal ?? ''),
    deepMotivation: String(p.deepMotivation ?? ''),
    fatalFlaw: String(p.fatalFlaw ?? ''),
    signatureLanguageStyle: String(p.signatureLanguageStyle ?? ''),
    backstory: String(p.backstory ?? ''),
    personalityTraits: String(p.personalityTraits ?? ''),
  }));
}
