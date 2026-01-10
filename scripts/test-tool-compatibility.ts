/**
 * Test tool use compatibility across different API clients
 * Usage: npx tsx scripts/test-tool-compatibility.ts
 */

import Anthropic from '@anthropic-ai/sdk';

// Simple calculator tool definition
const calculatorTool = {
  name: 'calculator',
  description: 'Perform basic math calculations',
  input_schema: {
    type: 'object' as const,
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The math operation to perform',
      },
      a: { type: 'number', description: 'First number' },
      b: { type: 'number', description: 'Second number' },
    },
    required: ['operation', 'a', 'b'],
  },
};

async function testAnthropicToolUse() {
  console.log('\n🧪 Testing Anthropic API Tool Use\n');
  console.log('API Key prefix:', process.env.ANTHROPIC_API_KEY?.substring(0, 10) + '...');
  console.log('Base URL:', process.env.ANTHROPIC_BASE_URL || '(default)');

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });

  try {
    console.log('\n📤 Sending request with calculator tool...');
    
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 256,
      messages: [
        { role: 'user', content: 'What is 15 multiplied by 7? Use the calculator tool.' }
      ],
      tools: [calculatorTool],
    });

    console.log('\n✅ Response received!');
    console.log('Stop reason:', response.stop_reason);
    
    if (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(b => b.type === 'tool_use');
      if (toolUse && toolUse.type === 'tool_use') {
        console.log('\n🔧 Tool called:', toolUse.name);
        console.log('Input:', JSON.stringify(toolUse.input, null, 2));
        console.log('\n✅ ANTHROPIC TOOL USE: WORKING');
        return true;
      }
    } else if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        console.log('\n⚠️ Model responded with text instead of using tool:');
        console.log(textBlock.text.substring(0, 200));
      }
      console.log('\n⚠️ ANTHROPIC TOOL USE: Model did not use tool');
      return false;
    }
    
    return false;
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
    if (error.status) console.log('Status:', error.status);
    if (error.error) console.log('Error details:', JSON.stringify(error.error, null, 2));
    console.log('\n❌ ANTHROPIC TOOL USE: FAILED');
    return false;
  }
}

async function testAnthropicWithoutTool() {
  console.log('\n🧪 Testing Anthropic API WITHOUT Tool (baseline)\n');

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Say "hello" in one word.' }
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      console.log('Response:', textBlock.text);
      console.log('\n✅ ANTHROPIC (NO TOOL): WORKING');
      return true;
    }
    return false;
  } catch (error: any) {
    console.log('❌ Error:', error.message);
    console.log('\n❌ ANTHROPIC (NO TOOL): FAILED');
    return false;
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('   Tool Use Compatibility Test');
  console.log('═'.repeat(60));

  // Check environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('\n❌ ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const results: { test: string; passed: boolean }[] = [];

  // Test 1: Basic API without tools
  const basicPassed = await testAnthropicWithoutTool();
  results.push({ test: 'Anthropic (no tool)', passed: basicPassed });

  // Test 2: API with tool use
  const toolPassed = await testAnthropicToolUse();
  results.push({ test: 'Anthropic (with tool)', passed: toolPassed });

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('   Summary');
  console.log('═'.repeat(60));
  
  for (const r of results) {
    console.log(`${r.passed ? '✅' : '❌'} ${r.test}`);
  }

  if (!toolPassed && basicPassed) {
    console.log('\n💡 Diagnosis: API proxy does not support tool use.');
    console.log('   Basic requests work, but tool definitions are rejected.');
    console.log('   AG-02 test requires direct Anthropic API access.');
  }
}

main().catch(console.error);
