// Agent configuration

import { AgentPersona } from '../types';

/**
 * Build a system prompt for an agent based on their persona and the topic
 * @param toolsEnabled - when false, omit web search instructions (for scene dialogue)
 */
export function buildAgentSystemPrompt(
  persona: AgentPersona,
  topic: string,
  toolsEnabled: boolean = true
): string {
  const basePrompt = persona.systemPrompt;

  const contextPrompt = toolsEnabled
    ? `
# Discussion Topic
You are participating in a round table discussion on the following topic:

**Topic: ${topic}**

# IMPORTANT - Remember:
- Stay in character as ${persona.name}
- Use the web search tool when you need evidence to support your arguments
- Keep responses SHORT (under 150 words typically) - real people don't write essays
- Respond naturally to what previous agents said - don't repeat their points
- If you use web search, cite your sources naturally in the text

# Your Role
${persona.description}
`
    : `
# Scene Context
${topic}

# IMPORTANT - Remember:
- Stay in character as ${persona.name}
- Treat the conversation history as lived memory, including lines marked as things you already said
- Keep responses SHORT (1-2 sentences) - this is dialogue, not monologue
- React to the latest line, but never restate the same opinion, apology, reassurance, metaphor, or decision
- Every turn must change the scene state in a small concrete way: reveal information, make a choice, resist, concede, escalate, ask for something specific, or redirect
- Speak from your immediate need in this scene; long-term goals are subtext, not a topic to force into every line
- Stay anchored to the current setting, relationship, and emotional goal. Do not drift into generic advice or unrelated life lessons
- If another character circles the same point, challenge, evade, interrupt, or move the conversation to a new practical detail
- Protect your social face like a real person: hide shame, test loyalty, dodge vulnerability, bargain, deflect, or attack the weak spot before admitting the truth
- Do not be too cooperative. Real people often misunderstand, interrupt, answer the wrong question, or cling to a small practical detail when pressured
- Make status and relationship visible through address forms, omissions, hesitation, sarcasm, politeness, silence, and what you refuse to answer
- Avoid generic control lines like "stop it", "sit down", "continue", "trust me", or "you do not understand" unless the line includes a concrete cost, object, deadline, public embarrassment, or immediate consequence
- Never mention the scene, plot, script, drama, audience, or that you are a character
- Avoid poetic slogans, animal metaphors, farming clichés, motivational speeches, and neat moral summaries unless the scene specifically demands them
- Prefer concrete pressure, objects, risks, numbers, names, and immediate actions over abstract words like courage, destiny, hope, warmth, or life lesson
- If the scene context includes a previous senior screenwriter review, treat it as a hard correction order and do not repeat any phrase, metaphor, behavior, or flaw named in that feedback
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
