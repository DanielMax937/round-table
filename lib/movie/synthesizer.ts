import { streamChatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';

export interface ScriptSynthesisInput {
  movieTitle: string;
  sceneHeading: string;
  sceneDescription: string;
  characters: Array<{ name: string; backstory: string }>;
  messages: Array<{ characterName: string; content: string; roundNumber: number }>;
}

export type ScriptEvent =
  | { type: 'finalize-start'; data: { timestamp: Date } }
  | { type: 'chunk'; data: { chunk: string; timestamp: Date } }
  | { type: 'finalize-complete'; data: { fullContent: string; timestamp: Date } }
  | { type: 'error'; data: { error: string; timestamp: Date } };

export async function* synthesizeScript(
  input: ScriptSynthesisInput
): AsyncGenerator<ScriptEvent> {
  if (!input.messages.length) {
    yield { type: 'error', data: { error: 'No dialogue to finalize', timestamp: new Date() } };
    return;
  }

  yield { type: 'finalize-start', data: { timestamp: new Date() } };

  try {
    const prompt = buildScriptPrompt(input);
    const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
    const stream = streamChatCompletion(messages, { temperature: 0.7 });

    let fullContent = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        fullContent += chunk.delta;
        yield { type: 'chunk', data: { chunk: chunk.delta, timestamp: new Date() } };
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
    }

    yield { type: 'finalize-complete', data: { fullContent, timestamp: new Date() } };
  } catch (error) {
    yield {
      type: 'error',
      data: {
        error: `Script finalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      },
    };
  }
}

function buildScriptPrompt(input: ScriptSynthesisInput): string {
  let prompt = `You are a professional screenwriter. Rewrite the following improvised dialogue into proper screenplay format.\n\n`;
  prompt += `**Movie:** ${input.movieTitle}\n`;
  prompt += `**Scene:** ${input.sceneHeading}\n`;
  prompt += `**Description:** ${input.sceneDescription}\n\n`;

  prompt += `**Characters:**\n`;
  for (const char of input.characters) {
    prompt += `- ${char.name}: ${char.backstory.substring(0, 100)}\n`;
  }

  prompt += `\n**Raw Improvised Dialogue:**\n\n`;

  let currentRound = 0;
  for (const msg of input.messages) {
    if (msg.roundNumber !== currentRound) {
      currentRound = msg.roundNumber;
      prompt += `--- Round ${currentRound} ---\n`;
    }
    prompt += `${msg.characterName}: ${msg.content}\n\n`;
  }

  prompt += `\n---\n\n`;
  prompt += `Rewrite this into proper screenplay format:\n`;
  prompt += `1. Start with a slug line (INT./EXT. LOCATION - TIME)\n`;
  prompt += `2. Add brief action/scene description\n`;
  prompt += `3. Format dialogue with CHARACTER NAME in caps, optional (parentheticals), and dialogue\n`;
  prompt += `4. Add natural action beats between dialogue where appropriate\n`;
  prompt += `5. Keep the essence and personality of each character's lines\n`;
  prompt += `6. You may condense, reorder, or polish lines for dramatic effect\n`;
  prompt += `7. Output clean screenplay text — no markdown headers or code blocks`;

  return prompt;
}
