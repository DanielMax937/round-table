import OpenAI from 'openai';
import type { LLMConfig, LLMMessage, LLMStreamChunk } from './types';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env file with override to prioritize file values over shell env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    // Override process.env with .env file values
    Object.keys(envConfig).forEach(key => {
        process.env[key] = envConfig[key];
    });
}

/**
 * Get LLM configuration from environment variables (.env file takes precedence)
 */
export function getLLMConfig(): LLMConfig {
    const baseURL = process.env.OPENAI_BASE_URL;
    const apiKey = process.env.OPENAI_API_KEY || '';
    const model = process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo';

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }

    return {
        baseURL,
        apiKey,
        model,
    };
}

/**
 * Create OpenAI client with custom configuration
 */
export function createLLMClient(config?: Partial<LLMConfig>): OpenAI {
    const finalConfig = { ...getLLMConfig(), ...config };

    return new OpenAI({
        baseURL: finalConfig.baseURL,
        apiKey: finalConfig.apiKey,
    });
}

/**
 * Stream chat completion from OpenAI
 */
export async function* streamChatCompletion(
    messages: LLMMessage[],
    options: {
        client?: OpenAI;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    } = {}
): AsyncGenerator<LLMStreamChunk> {
    const client = options.client || createLLMClient();
    const config = getLLMConfig();
    const model = options.model || config.model;

    console.log('[LLM] Initiating stream:', {
        model,
        messageCount: messages.length,
        baseURL: config.baseURL,
    });

    try {
        const stream = await client.chat.completions.create({
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: true,
        });

        let chunkCount = 0;
        let totalLength = 0;

        for await (const chunk of stream) {
            chunkCount++;
            const delta = chunk.choices[0]?.delta?.content;

            if (delta) {
                totalLength += delta.length;
                yield { type: 'content_delta', delta };
            } else {
                // Log chunks without content
                if (chunkCount <= 3) {
                    console.log('[LLM] Chunk #' + chunkCount, 'no content:', JSON.stringify(chunk).substring(0, 200));
                }
            }
        }

        console.log('[LLM] Stream complete:', { totalChunks: chunkCount, totalLength });
        yield { type: 'done' };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[LLM] Stream error:', errorMessage);
        yield { type: 'error', error: errorMessage };
        throw error;
    }
}
