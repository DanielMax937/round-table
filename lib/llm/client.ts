import OpenAI from 'openai';
import type { LLMConfig, LLMMessage, LLMStreamChunk, LLMTool, LLMToolCall } from './types';
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
 * Stream chat completion from OpenAI with optional function calling
 */
export async function* streamChatCompletion(
    messages: LLMMessage[],
    options: {
        client?: OpenAI;
        model?: string;
        temperature?: number;
        maxTokens?: number;
        tools?: LLMTool[];
    } = {}
): AsyncGenerator<LLMStreamChunk> {
    const client = options.client || createLLMClient();
    const config = getLLMConfig();
    const model = options.model || config.model;

    console.log('[LLM] Initiating stream:', {
        model,
        messageCount: messages.length,
        baseURL: config.baseURL,
        hasTools: !!options.tools?.length,
    });

    try {
        const requestParams: any = {
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
                ...(m.tool_calls && { tool_calls: m.tool_calls }),
                ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
            })),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: true,
        };

        // Add tools if provided
        if (options.tools && options.tools.length > 0) {
            requestParams.tools = options.tools;
        }

        const stream = await client.chat.completions.create(requestParams);

        let chunkCount = 0;
        let totalLength = 0;
        let currentToolCall: Partial<LLMToolCall> | null = null;
        let toolCallArguments = '';

        for await (const chunk of stream) {
            chunkCount++;
            const choice = chunk.choices[0];
            const delta = choice?.delta;

            // Handle content delta
            if (delta?.content) {
                totalLength += delta.content.length;
                yield { type: 'content_delta', delta: delta.content };
            }

            // Handle tool calls
            if (delta?.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                    if (toolCallDelta.id) {
                        // New tool call starting
                        if (currentToolCall && currentToolCall.id) {
                            // Complete previous tool call
                            yield {
                                type: 'tool_call_complete',
                                toolCall: {
                                    id: currentToolCall.id,
                                    type: 'function',
                                    function: {
                                        name: currentToolCall.function?.name || '',
                                        arguments: toolCallArguments,
                                    },
                                },
                            };
                        }
                        currentToolCall = {
                            id: toolCallDelta.id,
                            type: 'function',
                            function: {
                                name: toolCallDelta.function?.name || '',
                                arguments: '',
                            },
                        };
                        toolCallArguments = toolCallDelta.function?.arguments || '';
                    } else if (toolCallDelta.function?.arguments) {
                        // Accumulate arguments
                        toolCallArguments += toolCallDelta.function.arguments;
                    }
                    if (toolCallDelta.function?.name && currentToolCall) {
                        currentToolCall.function = {
                            name: toolCallDelta.function.name,
                            arguments: '',
                        };
                    }
                }
            }

            // Check for finish reason
            if (choice?.finish_reason === 'tool_calls' && currentToolCall?.id) {
                yield {
                    type: 'tool_call_complete',
                    toolCall: {
                        id: currentToolCall.id,
                        type: 'function',
                        function: {
                            name: currentToolCall.function?.name || '',
                            arguments: toolCallArguments,
                        },
                    },
                };
                currentToolCall = null;
                toolCallArguments = '';
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
