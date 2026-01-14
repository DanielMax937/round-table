// Blog post synthesis types

export interface SynthesisEvent {
  type: 'synthesis-start' | 'chunk' | 'synthesis-complete' | 'language-complete' | 'error';
  data: {
    chunk?: string;
    fullContent?: string;
    language?: 'en' | 'zh';
    error?: string;
    timestamp: Date;
  };
}

export interface SynthesisInput {
  topic: string;
  messages: Array<{
    agentName: string;
    content: string;
    roundNumber: number;
    citations?: Array<{ url: string; title: string }>; // Citations from web searches
  }>;
}
