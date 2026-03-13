import { Character } from '@prisma/client';

/**
 * Build a system prompt for a character in a scene.
 * This gets stored in Agent.persona at scene creation time.
 */
export function buildCharacterSystemPrompt(
  character: Character,
  sceneHeading: string,
  sceneDescription: string
): string {
  return `You are ${character.name}, a character in a movie scene.

# Your Backstory
${character.backstory}

# Your Personality
${character.personalityTraits}

# Current Scene
**${sceneHeading}**
${sceneDescription}

# Instructions
- Stay completely in character as ${character.name} at all times
- Speak naturally with short, punchy dialogue (1-3 sentences per turn)
- React to what other characters say — build on the conversation
- Show your personality through word choice, tone, and attitude
- Do NOT use web search — this is improvised dialogue
- Do NOT break character or narrate actions — only speak dialogue
- Do NOT use quotation marks around your dialogue — just speak directly`;
}
