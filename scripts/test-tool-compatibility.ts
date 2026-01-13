/**
 * Test tool use compatibility using Claude Agent SDK
 * Usage: npx tsx scripts/test-tool-compatibility.ts
 */

import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

async function testAgentSDKToolUse() {
  console.log('\n🧪 Testing Claude Agent SDK Tool Use\n');

  let toolWasUsed = false;
  let toolInput: any = null;

  // Create calculator tool using SDK's tool helper
  const calculatorTool = tool(
    'calculator',
    'Perform basic math calculations',
    {
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The math operation to perform'),
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    },
    async (args) => {
      console.log(`🔧 Calculator tool called with:`, args);
      toolWasUsed = true;
      toolInput = args;

      let result: number;
      switch (args.operation) {
        case 'add':
          result = args.a + args.b;
          break;
        case 'subtract':
          result = args.a - args.b;
          break;
        case 'multiply':
          result = args.a * args.b;
          break;
        case 'divide':
          result = args.a / args.b;
          break;
      }

      return { content: [{ type: 'text' as const, text: `Result: ${result}` }] };
    }
  );

  // Create MCP server with the calculator tool
  const mcpServer = createSdkMcpServer({
    name: 'test-tools',
    version: '1.0.0',
    tools: [calculatorTool],
  });

  try {
    console.log('📤 Sending request with calculator tool...');

    const stream = query({
      prompt: 'What is 15 multiplied by 7? Use the calculator tool.',
      options: {
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
      if (message.type === 'result') {
        break;
      }
    }

    if (toolWasUsed) {
      console.log('\n✅ Tool was called!');
      console.log('Input:', JSON.stringify(toolInput, null, 2));
      console.log('\n✅ CLAUDE AGENT SDK TOOL USE: WORKING');
      return true;
    } else {
      console.log('\n⚠️ Model did not use tool');
      console.log('\n⚠️ CLAUDE AGENT SDK TOOL USE: Model did not use tool');
      return false;
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
    console.log('\n❌ CLAUDE AGENT SDK TOOL USE: FAILED');
    return false;
  }
}

async function testAgentSDKWithoutTool() {
  console.log('\n🧪 Testing Claude Agent SDK WITHOUT Tool (baseline)\n');

  try {
    let responseText = '';

    const stream = query({
      prompt: 'Say "hello" in one word.',
      options: {
        model: 'claude-sonnet-4-20250514',
        includePartialMessages: true,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
      },
    });

    for await (const message of stream) {
      if (message.type === 'stream_event') {
        const event = (message as any).event;
        if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
          responseText += event.delta.text;
        }
      }
      if (message.type === 'result') {
        if (!responseText && (message as any).result) {
          const result = (message as any).result;
          if (result.content) {
            for (const block of result.content) {
              if (block.type === 'text') {
                responseText += block.text;
              }
            }
          }
        }
        break;
      }
    }

    console.log('Response:', responseText);
    console.log('\n✅ CLAUDE AGENT SDK (NO TOOL): WORKING');
    return true;
  } catch (error: any) {
    console.log('❌ Error:', error.message);
    console.log('\n❌ CLAUDE AGENT SDK (NO TOOL): FAILED');
    return false;
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('   Claude Agent SDK Tool Use Compatibility Test');
  console.log('═'.repeat(60));

  // Check environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('\n❌ ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const results: { test: string; passed: boolean }[] = [];

  // Test 1: Basic API without tools
  const basicPassed = await testAgentSDKWithoutTool();
  results.push({ test: 'Claude Agent SDK (no tool)', passed: basicPassed });

  // Test 2: API with tool use
  const toolPassed = await testAgentSDKToolUse();
  results.push({ test: 'Claude Agent SDK (with tool)', passed: toolPassed });

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('   Summary');
  console.log('═'.repeat(60));

  for (const r of results) {
    console.log(`${r.passed ? '✅' : '❌'} ${r.test}`);
  }

  if (!toolPassed && basicPassed) {
    console.log('\n💡 Diagnosis: Tool use may not be working correctly.');
    console.log('   Basic requests work, but tool definitions may have issues.');
  }
}

main().catch(console.error);
