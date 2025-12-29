// Blog post synthesis using Claude API

import Anthropic from '@anthropic-ai/sdk';
import { SynthesisEvent, SynthesisInput } from './types';

/**
 * Build synthesis prompt from discussion messages
 */
function buildSynthesisPrompt(input: SynthesisInput): string {
  // Group messages by round
  const roundGroups = new Map<number, Array<{ agentName: string; content: string }>>();

  for (const msg of input.messages) {
    if (!roundGroups.has(msg.roundNumber)) {
      roundGroups.set(msg.roundNumber, []);
    }
    roundGroups.get(msg.roundNumber)!.push({
      agentName: msg.agentName,
      content: msg.content
    });
  }

  // Build prompt
  let prompt = `You are synthesizing a blog post from a multi-agent AI discussion on the topic: "${input.topic}"\n\n`;
  prompt += `The following agents discussed this topic across ${roundGroups.size} round(s):\n\n`;

  // Add discussion content
  for (const [roundNum, messages] of Array.from(roundGroups.entries()).sort(([a], [b]) => a - b)) {
    prompt += `## Round ${roundNum}\n\n`;
    for (const msg of messages) {
      prompt += `**${msg.agentName}:**\n${msg.content}\n\n`;
    }
  }

  prompt += `\n---\n\n`;
  prompt += `Please synthesize this discussion into a compelling blog post suitable for Substack:\n\n`;
  prompt += `1. Write an engaging introduction that frames the topic\n`;
  prompt += `2. Organize the key themes and perspectives into clear sections\n`;
  prompt += `3. Integrate insights from different agents into a cohesive narrative\n`;
  prompt += `4. Write a conclusion that synthesizes the main takeaways\n`;
  prompt += `5. Use an engaging, accessible writing style (not academic)\n`;
  prompt += `6. Target length: 1000-1500 words\n`;
  prompt += `7. Format in clean markdown with proper headers and structure\n\n`;
  prompt += `Do not mention that this came from AI agents - write as if you're a single author synthesizing these perspectives.`;

  return prompt;
}

/**
 * Synthesize blog post from discussion with streaming
 */
export async function* synthesizeBlogPost(
  input: SynthesisInput,
  apiKey: string
): AsyncGenerator<SynthesisEvent> {
  const anthropic = new Anthropic({
    apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });

  yield {
    type: 'synthesis-start',
    data: { timestamp: new Date() }
  };

  try {
    const prompt = buildSynthesisPrompt(input);

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: true,
    });

    let fullContent = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          const chunk = event.delta.text;
          fullContent += chunk;

          yield {
            type: 'chunk',
            data: {
              chunk,
              timestamp: new Date()
            }
          };
        }
      }
    }

    yield {
      type: 'synthesis-complete',
      data: {
        fullContent,
        timestamp: new Date()
      }
    };

  } catch (error) {
    yield {
      type: 'error',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    };
  }
}
