/**
 * AG-02: Tool Use Decision Test
 * Tests that an agent correctly identifies when to use web_search tool
 */

import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { performWebSearch, formatSearchResults } from '../lib/agents/tools/websearch';
import { z } from 'zod';

async function testToolUseDecision() {
  console.log('🧪 AG-02: Testing Tool Use Decision\n');

  let toolWasUsed = false;
  let searchQuery = '';

  // Create web search tool using SDK's tool helper
  const webSearchTool = tool(
    'web_search',
    'Search the web for current information, facts, or recent events. Use key terms only.',
    { query: z.string().describe('The search query terms') },
    async (args) => {
      console.log(`🔍 Executing web_search tool with query: "${args.query}"`);
      toolWasUsed = true;
      searchQuery = args.query;

      try {
        const results = await performWebSearch(args.query);
        console.log('Found', results.length, 'results');

        if (results.length > 0) {
          console.log('\nFirst result:');
          console.log('  Title:', results[0].title);
          console.log('  URL:', results[0].url);
        }

        const content = formatSearchResults(results);
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (error: any) {
        console.error("Web search failed:", error);
        return { content: [{ type: 'text' as const, text: `Search failed: ${error.message}` }] };
      }
    }
  );

  // Create MCP server with the web search tool
  const mcpServer = createSdkMcpServer({
    name: 'test-tools',
    version: '1.0.0',
    tools: [webSearchTool],
  });

  console.log('📤 Sending request to Claude with web_search tool...\n');

  const stream = query({
    prompt: 'What are the latest AI research breakthroughs in January 2026? Please search the web for current information.',
    options: {
      systemPrompt: 'You are a helpful assistant. When asked about current events or information that might have changed recently, use the web_search tool to find up-to-date information.',
      model: 'claude-sonnet-4-20250514',
      mcpServers: {
        'test-tools': mcpServer,
      },
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      persistSession: false,
    },
  });

  for await (const message of stream) {
    // Just consume the stream
    if (message.type === 'result') {
      break;
    }
  }

  if (toolWasUsed) {
    console.log('\n✅ AG-02 PASSED - Agent uses web_search tool correctly!');
    console.log('Query used:', searchQuery);
    return true;
  } else {
    console.log('⚠️ Agent did NOT use tool');
    return false;
  }
}

testToolUseDecision().catch(console.error);
