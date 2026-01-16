export interface LLMConfig {
    baseURL?: string;
    apiKey: string;
    model: string;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: LLMToolCall[];
    tool_call_id?: string;
}

export interface LLMToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface LLMTool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, {
                type: string;
                description: string;
            }>;
            required: string[];
        };
    };
}

export interface LLMStreamChunk {
    type: 'content_delta' | 'tool_call_delta' | 'tool_call_complete' | 'done' | 'error';
    delta?: string;
    error?: string;
    toolCall?: LLMToolCall;
}
