// Blog post synthesis types

export interface SynthesisEvent {
  type: 'synthesis-start' | 'chunk' | 'synthesis-complete' | 'error';
  data: {
    chunk?: string;
    fullContent?: string;
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
  }>;
}
