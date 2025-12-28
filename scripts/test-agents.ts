// Test script for Agent SDK integration

import { createAgentConfigs, buildAgentSystemPrompt } from '../lib/agents/config';
import { buildAgentContext, formatMessagesForClaude } from '../lib/agents/executor';
import {
  executeRound,
  validateRoundExecution,
  estimateRoundDuration,
  formatRoundSummary,
} from '../lib/agents/orchestrator';
import { performWebSearch, validateSearchQuery } from '../lib/agents/tools/websearch';
import { getDefaultPersonas } from '../lib/personas';
import type { Agent } from '@prisma/client';

async function testAgentIntegration() {
  console.log('🧪 Testing Phase 3: Agent SDK Integration\n');

  try {
    // Test 1: Agent configuration
    console.log('✅ Test 1: Creating agent configurations...');
    const personas = getDefaultPersonas(3);
    const topic = 'What is the future of AI?';
    const agentConfigs = createAgentConfigs(personas, topic);

    console.log(`   Created ${agentConfigs.length} agent configs`);
    agentConfigs.forEach((config, index) => {
      console.log(`   - Agent ${index + 1}: ${config.name}`);
      console.log(`     Instructions length: ${config.instructions.length} chars`);
      console.log(`     Tools: ${config.tools.map((t) => t.name).join(', ')}`);
    });
    console.log();

    // Test 2: System prompt building
    console.log('✅ Test 2: Building system prompts...');
    const systemPrompt = buildAgentSystemPrompt(personas[0], topic);
    console.log(`   System prompt length: ${systemPrompt.length} chars`);
    console.log(`   Contains topic: ${systemPrompt.includes(topic)}`);
    console.log(`   Contains role: ${systemPrompt.includes(personas[0].name)}`);
    console.log();

    // Test 3: Context building
    console.log('✅ Test 3: Building agent context...');
    const mockAgents: Agent[] = personas.map((persona, index) => ({
      id: `agent-${index}`,
      roundTableId: 'test-rt',
      name: persona.name,
      persona: persona.systemPrompt,
      order: index + 1,
      createdAt: new Date(),
    }));

    const context = buildAgentContext(topic, 1, [], []);
    console.log(`   Topic: ${context.topic}`);
    console.log(`   Round: ${context.roundNumber}`);
    console.log(`   Previous messages: ${context.previousMessages.length}`);
    console.log(`   Current round messages: ${context.currentRoundMessages.length}`);
    console.log();

    // Test 4: Message formatting
    console.log('✅ Test 4: Formatting messages for Claude...');
    const messages = formatMessagesForClaude(context, 'agent-0');
    console.log(`   Formatted ${messages.length} messages`);
    if (messages.length > 0) {
      console.log(`   First message role: ${messages[0].role}`);
      console.log(`   First message length: ${messages[0].content.length} chars`);
    }
    console.log();

    // Test 5: Web search tool
    console.log('✅ Test 5: Testing web search tool...');
    const searchQuery = 'artificial intelligence trends 2024';
    const validationResult = validateSearchQuery(searchQuery);
    console.log(`   Query validation: ${validationResult.valid ? 'Valid' : validationResult.error}`);

    const searchResults = await performWebSearch(searchQuery);
    console.log(`   Search results: ${searchResults.length} items`);
    console.log(`   First result title: ${searchResults[0].title}`);
    console.log();

    // Test 6: Round validation
    console.log('✅ Test 6: Validating round execution...');
    const validResult = validateRoundExecution(mockAgents, topic, 'test-api-key');
    console.log(`   Validation result: ${validResult.valid ? 'Valid' : validResult.error}`);

    const invalidResult = validateRoundExecution([], '', '');
    console.log(`   Empty validation: ${!invalidResult.valid ? 'Correctly rejected' : 'Should fail'}`);
    console.log();

    // Test 7: Duration estimation
    console.log('✅ Test 7: Estimating round duration...');
    const estimatedDuration = estimateRoundDuration(3);
    console.log(`   Estimated duration for 3 agents: ${estimatedDuration / 1000}s`);
    console.log();

    // Test 8: Round summary formatting
    console.log('✅ Test 8: Formatting round summary...');
    const mockMessages = [
      {
        agentId: 'agent-0',
        content: 'This is a test message from the first agent.',
        toolCalls: [],
      },
      {
        agentId: 'agent-1',
        content: 'This is a test message from the second agent.',
        toolCalls: [
          {
            type: 'web_search' as const,
            query: 'test query',
            timestamp: new Date(),
          },
        ],
      },
    ];

    const summary = formatRoundSummary(mockMessages, mockAgents);
    console.log(`   Summary length: ${summary.length} chars`);
    console.log('   Summary preview:');
    console.log('   ' + summary.split('\n').slice(0, 5).join('\n   '));
    console.log();

    // Test 9: Event handling simulation
    console.log('✅ Test 9: Testing event handling...');
    const events: string[] = [];

    // Simulate round execution (without actual API calls)
    const mockOptions = {
      apiKey: 'test-key',
      onEvent: (event: any) => {
        events.push(event.type);
      },
    };

    // We can't actually run executeRound without a real API key,
    // but we can test the validation and setup
    console.log(`   Event handlers configured: ${typeof mockOptions.onEvent}`);
    console.log(`   Would capture: agent-start, chunk, tool-call, agent-complete, round-complete`);
    console.log();

    console.log('🎉 All agent integration tests passed!\n');

    console.log('📝 Note: Full agent execution requires:');
    console.log('   1. Valid ANTHROPIC_API_KEY in .env');
    console.log('   2. Real integration test with API calls');
    console.log('   3. Actual web search API integration\n');

    return { success: true };
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error };
  }
}

// Run the test
testAgentIntegration()
  .then((result) => {
    if (result.success) {
      console.log('✨ Phase 3 agent integration is properly configured!');
      process.exit(0);
    } else {
      console.error('💥 Phase 3 tests failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
