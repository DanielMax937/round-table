// Blog post synthesis using OpenAI client

import { streamChatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import { SynthesisEvent, SynthesisInput } from './types';

/**
 * Collect all unique citations from messages
 */
function collectCitations(input: SynthesisInput): Map<string, string> {
  const allCitations = new Map<string, string>(); // url -> title
  for (const msg of input.messages) {
    if (msg.citations) {
      for (const citation of msg.citations) {
        if (!allCitations.has(citation.url)) {
          allCitations.set(citation.url, citation.title);
        }
      }
    }
  }
  return allCitations;
}

/**
 * Format references section in specified language
 */
function formatReferences(citations: Map<string, string>, language: 'en' | 'zh'): string {
  if (citations.size === 0) return '';

  const header = language === 'zh' ? '\n\n---\n\n## 参考资料\n\n' : '\n\n---\n\n## References\n\n';
  let refs = header;
  let idx = 1;
  for (const [url, title] of citations) {
    refs += `${idx}. [${title}](${url})\n`;
    idx++;
  }
  return refs;
}

/**
 * Build synthesis prompt from discussion messages for specified language
 */
function buildSynthesisPrompt(input: SynthesisInput, language: 'en' | 'zh'): string {
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
  prompt += `7. Format in clean markdown with proper headers and structure\n`;
  prompt += `8. If relevant sources were consulted during the discussion (listed below), you may reference them naturally in the blog post\n\n`;

  // Language-specific instructions
  if (language === 'zh') {
    prompt += `IMPORTANT: Write the ENTIRE blog post in Chinese (中文). Use natural, fluent Chinese that reads well for native speakers. All headings, content, and text should be in Chinese.\n\n`;
  } else {
    prompt += `IMPORTANT: Write the ENTIRE blog post in English. Use clear, natural English throughout.\n\n`;
  }

  prompt += `Do not mention that this came from AI agents - write as if you're a single author synthesizing these perspectives.`;

  // Collect and add sources list to prompt if citations exist
  const allCitations = collectCitations(input);
  if (allCitations.size > 0) {
    prompt += `\n\n### Sources Consulted During Discussion:\n`;
    let idx = 1;
    for (const [url, title] of allCitations) {
      prompt += `[${idx}] ${title} - ${url}\n`;
      idx++;
    }
  }

  return prompt;
}

/**
 * Synthesize blog post from discussion with streaming - generates both English and Chinese versions
 */
export async function* synthesizeBlogPost(
  input: SynthesisInput,
  apiKey: string
): AsyncGenerator<SynthesisEvent> {
  // Input validation
  if (!input.topic || input.topic.trim().length === 0) {
    yield {
      type: 'error',
      data: {
        error: 'Topic cannot be empty',
        timestamp: new Date()
      }
    };
    return;
  }

  if (!input.messages || input.messages.length === 0) {
    yield {
      type: 'error',
      data: {
        error: 'Messages array cannot be empty',
        timestamp: new Date()
      }
    };
    return;
  }

  if (!apiKey || apiKey.trim().length === 0) {
    yield {
      type: 'error',
      data: {
        error: 'API key is required',
        timestamp: new Date()
      }
    };
    return;
  }

  const citations = collectCitations(input);

  // Generate English version
  yield {
    type: 'synthesis-start',
    data: { language: 'en', timestamp: new Date() }
  };

  try {
    const englishPrompt = buildSynthesisPrompt(input, 'en');
    let englishContent = '';

    const messages: LLMMessage[] = [
      { role: 'user', content: englishPrompt },
    ];

    const englishStream = streamChatCompletion(messages);

    for await (const chunk of englishStream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        englishContent += chunk.delta;

        yield {
          type: 'chunk',
          data: {
            chunk: chunk.delta,
            language: 'en',
            timestamp: new Date()
          }
        };
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
    }

    // Append references to English version
    if (citations.size > 0) {
      const refs = formatReferences(citations, 'en');
      englishContent += refs;

      yield {
        type: 'chunk',
        data: {
          chunk: refs,
          language: 'en',
          timestamp: new Date()
        }
      };
    }

    yield {
      type: 'language-complete',
      data: {
        fullContent: englishContent,
        language: 'en',
        timestamp: new Date()
      }
    };

  } catch (error) {
    yield {
      type: 'error',
      data: {
        error: `English generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
    };
    return;
  }

  // Generate Chinese version
  yield {
    type: 'synthesis-start',
    data: { language: 'zh', timestamp: new Date() }
  };

  try {
    const chinesePrompt = buildSynthesisPrompt(input, 'zh');
    let chineseContent = '';

    const messages: LLMMessage[] = [
      { role: 'user', content: chinesePrompt },
    ];

    const chineseStream = streamChatCompletion(messages);

    for await (const chunk of chineseStream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        chineseContent += chunk.delta;

        yield {
          type: 'chunk',
          data: {
            chunk: chunk.delta,
            language: 'zh',
            timestamp: new Date()
          }
        };
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
    }

    // Append references to Chinese version
    if (citations.size > 0) {
      const refs = formatReferences(citations, 'zh');
      chineseContent += refs;

      yield {
        type: 'chunk',
        data: {
          chunk: refs,
          language: 'zh',
          timestamp: new Date()
        }
      };
    }

    yield {
      type: 'language-complete',
      data: {
        fullContent: chineseContent,
        language: 'zh',
        timestamp: new Date()
      }
    };

  } catch (error) {
    yield {
      type: 'error',
      data: {
        error: `Chinese generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
    };
    return;
  }

  yield {
    type: 'synthesis-complete',
    data: { timestamp: new Date() }
  };
}
