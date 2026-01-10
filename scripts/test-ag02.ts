/**
 * AG-02: Tool Use Decision Test
 * Tests that an agent correctly identifies when to use web_search tool
 */

import Anthropic from '@anthropic-ai/sdk';
import { performWebSearch } from '../lib/agents/tools/websearch';

// Corrected tool definition with snake_case input_schema
const webSearchToolFixed = {
  name: "web_search",
  description: "Search the web for current information, facts, or recent events.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query terms"
      }
    },
    required: ["query"]
  }
};

async function testToolUseDecision() {
  console.log('🧪 AG-02: Testing Tool Use Decision\n');
  
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });

  console.log('Base URL:', process.env.ANTHROPIC_BASE_URL || '(default)');
  
  const messages: Anthropic.MessageParam[] = [
    { 
      role: 'user', 
      content: 'What are the latest AI research breakthroughs in January 2026? Please search the web for current information.' 
    }
  ];
  
  console.log('📤 Sending request to Claude with web_search tool...\n');
  
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',  // Use supported model
    max_tokens: 1024,
    system: 'You are a helpful assistant. When asked about current events or information that might have changed recently, use the web_search tool to find up-to-date information.',
    messages,
    tools: [webSearchToolFixed],
  });
  
  console.log('Response stop_reason:', response.stop_reason);
  
  if (response.stop_reason === 'tool_use') {
    console.log('✅ Agent decided to use tool!\n');
    
    // Find tool use block
    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (toolUse && toolUse.type === 'tool_use') {
      console.log('Tool:', toolUse.name);
      console.log('Query:', JSON.stringify(toolUse.input));
      
      // Execute search
      const input = toolUse.input as { query: string };
      console.log('\n🔍 Executing web search...');
      const results = await performWebSearch(input.query, 3);
      console.log('Found', results.length, 'results');
      
      if (results.length > 0) {
        console.log('\nFirst result:');
        console.log('  Title:', results[0].title);
        console.log('  URL:', results[0].url);
      }
      
      console.log('\n✅ AG-02 PASSED - Agent uses web_search tool correctly!');
      return true;
    }
  } else {
    console.log('⚠️ Agent did NOT use tool');
    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      console.log('Response preview:', textBlock.text.substring(0, 300));
    }
    return false;
  }
  
  return false;
}

testToolUseDecision().catch(console.error);
