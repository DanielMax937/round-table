// Test script for database operations

import {
  createRoundTable,
  getRoundTable,
  getAllRoundTables,
  updateRoundTableStatus,
} from '../lib/db/roundtable';
import { getAgentsByRoundTable } from '../lib/db/agents';
import {
  createRound,
  getRoundWithMessages,
  getRoundsByRoundTable,
  getNextRoundNumber,
  completeRound,
} from '../lib/db/rounds';
import { createMessage, getMessagesByRound } from '../lib/db/messages';

async function testDatabaseOperations() {
  console.log('🧪 Testing Phase 2: Database Operations\n');

  try {
    // Test 1: Create a round table
    console.log('✅ Test 1: Creating round table...');
    const roundTable = await createRoundTable('What is the future of AI?', 3);
    console.log(`   Created round table ID: ${roundTable.id}`);
    console.log(`   Topic: ${roundTable.topic}`);
    console.log(`   Agents: ${roundTable.agents.length}`);
    console.log(`   Agent names: ${roundTable.agents.map((a) => a.name).join(', ')}\n`);

    // Test 2: Get the round table
    console.log('✅ Test 2: Retrieving round table...');
    const retrieved = await getRoundTable(roundTable.id);
    console.log(`   Retrieved round table: ${retrieved?.topic}\n`);

    // Test 3: Get agents
    console.log('✅ Test 3: Getting agents...');
    const agents = await getAgentsByRoundTable(roundTable.id);
    console.log(`   Found ${agents.length} agents`);
    agents.forEach((agent) => {
      console.log(`   - ${agent.name} (order: ${agent.order})`);
    });
    console.log();

    // Test 4: Create a round
    console.log('✅ Test 4: Creating round...');
    const roundNumber = await getNextRoundNumber(roundTable.id);
    console.log(`   Next round number: ${roundNumber}`);
    const round = await createRound(roundTable.id, roundNumber);
    console.log(`   Created round ID: ${round.id}`);
    console.log(`   Round number: ${round.roundNumber}\n`);

    // Test 5: Create messages
    console.log('✅ Test 5: Creating messages...');
    for (const agent of agents) {
      const message = await createMessage(
        round.id,
        agent.id,
        `This is a test message from ${agent.name}.`,
        [
          {
            type: 'web_search',
            query: 'test query',
            timestamp: new Date(),
          },
        ]
      );
      console.log(
        `   Created message from ${agent.name}: ${message.content.substring(0, 50)}...`
      );
    }
    console.log();

    // Test 6: Get messages
    console.log('✅ Test 6: Retrieving messages...');
    const messages = await getMessagesByRound(round.id);
    console.log(`   Retrieved ${messages.length} messages`);
    console.log(`   First message has tool calls: ${!!messages[0].toolCalls}\n`);

    // Test 7: Get round with messages
    console.log('✅ Test 7: Getting round with messages...');
    const roundWithMessages = await getRoundWithMessages(round.id);
    console.log(`   Round ${roundWithMessages?.roundNumber} has ${roundWithMessages?.messages.length} messages\n`);

    // Test 8: Complete round
    console.log('✅ Test 8: Completing round...');
    const completedRound = await completeRound(round.id);
    console.log(`   Round status: ${completedRound.status}`);
    console.log(`   Completed at: ${completedRound.completedAt?.toISOString()}\n`);

    // Test 9: Get all rounds
    console.log('✅ Test 9: Getting all rounds...');
    const rounds = await getRoundsByRoundTable(roundTable.id);
    console.log(`   Total rounds: ${rounds.length}\n`);

    // Test 10: Get all round tables
    console.log('✅ Test 10: Getting all round tables...');
    const allRoundTables = await getAllRoundTables();
    console.log(`   Total round tables in database: ${allRoundTables.length}\n`);

    // Test 11: Update round table status
    console.log('✅ Test 11: Updating round table status...');
    await updateRoundTableStatus(roundTable.id, 'paused');
    const updated = await getRoundTable(roundTable.id);
    console.log(`   New status: ${updated?.status}\n`);

    console.log('🎉 All database operation tests passed!\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    // Note: In a real test, we'd delete the test data here
    console.log('   (Test data left in database for inspection)\n');

    return {
      success: true,
      roundTableId: roundTable.id,
      roundId: round.id,
    };
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error };
  }
}

// Run the test
testDatabaseOperations()
  .then((result) => {
    if (result.success) {
      console.log('✨ Phase 2 database operations are working correctly!');
      process.exit(0);
    } else {
      console.error('💥 Phase 2 tests failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
