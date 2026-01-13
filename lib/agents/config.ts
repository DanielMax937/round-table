// Agent configuration

import { AgentPersona } from '../types';

/**
 * Build a system prompt for an agent based on their persona and the topic
 */
export function buildAgentSystemPrompt(persona: AgentPersona, topic: string): string {
  const basePrompt = persona.systemPrompt;

  const contextPrompt = `
# Discussion Topic
You are participating in a round table discussion on the following topic:

**Topic: ${topic}**

# Guidelines
- Stay in character as ${persona.name}
- Use the web search tool when you need evidence to support your arguments
- Be concise but thorough (aim for 2-4 paragraphs per response)
- Build on what previous agents have said
- Feel free to agree or disagree with other agents, but always explain your reasoning
- If you use web search, cite your sources

# Your Role
${persona.description}
`;

  return `${basePrompt}\n\n${contextPrompt}`.trim();
}

/**
 * Create an agent configuration for the Agent SDK
 */
export function createAgentConfig(
  name: string,
  persona: string,
  tools: any[]
): {
  name: string;
  instructions: string;
  tools: any[];
} {
  return {
    name,
    instructions: persona,
    tools,
  };
}

/**
 * Get the default web search tool configuration
 */
export function getWebSearchTool() {
  return {
    name: 'web_search',
    description:
      'Search the web for current information to support your arguments. Use this when you need facts, data, or examples to strengthen your points.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to execute',
        },
      },
      required: ['query'],
    },
  };
}

/**
 * Create a complete set of agents for a round table
 */
export function createAgentConfigs(
  personas: AgentPersona[],
  topic: string
): Array<{ name: string; instructions: string; tools: any[] }> {
  const webSearchTool = getWebSearchTool();

  return personas.map((persona) => {
    const systemPrompt = buildAgentSystemPrompt(persona, topic);

    return {
      name: persona.name,
      instructions: systemPrompt,
      tools: [webSearchTool],
    };
  });
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: {
  name: string;
  instructions: string;
  tools: any[];
}): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push('Agent name is required');
  }

  if (!config.instructions || config.instructions.trim().length === 0) {
    errors.push('Agent instructions are required');
  }

  if (!config.tools || !Array.isArray(config.tools)) {
    errors.push('Agent tools must be an array');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
