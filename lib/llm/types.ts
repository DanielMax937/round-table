export interface LLMConfig {
    baseURL?: string;
    apiKey: string;
    model: string;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMStreamChunk {
    type: 'content_delta' | 'done' | 'error';
    delta?: string;
    error?: string;
}
