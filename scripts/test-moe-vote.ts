// Integration test for MoE voting system

async function testMoeVoteWorkflow() {
  console.log('🧪 Testing MoE Vote Workflow\n');

  const baseUrl = 'http://localhost:3000';

  try {
    // Test 1: Create job
    console.log('1️⃣  Creating MoE vote job...');
    const createResponse = await fetch(`${baseUrl}/api/moe-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Should companies adopt a 4-day work week?',
        includeDiscussionAgentsInVoting: false,
        agentCount: 3,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create job: ${await createResponse.text()}`);
    }

    const { jobId, estimatedCompletionTime } = await createResponse.json();
    console.log(`   ✅ Job created: ${jobId}`);
    console.log(
      `   ⏱️  Estimated completion: ${Math.round(estimatedCompletionTime / 1000)}s\n`
    );

    // Test 2: Poll for progress
    console.log('2️⃣  Polling for progress...');
    let status = 'pending';
    let pollCount = 0;

    while (status !== 'completed' && status !== 'failed') {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5s

      const pollResponse = await fetch(`${baseUrl}/api/moe-vote/${jobId}`);
      const jobStatus = await pollResponse.json();
      status = jobStatus.status;

      pollCount++;

      if (jobStatus.progress) {
        console.log(
          `   📊 Round ${jobStatus.progress.currentRound}/${jobStatus.progress.totalRounds} - ${jobStatus.progress.phase}`
        );
      }

      // Safety limit for testing
      if (pollCount > 240) {
        // 20 minutes max
        console.log('   ⚠️  Polling timeout - job taking too long');
        break;
      }
    }

    // Test 3: Get final result
    console.log('\n3️⃣  Getting final result...');
    const finalResponse = await fetch(`${baseUrl}/api/moe-vote/${jobId}`);
    const finalJob = await finalResponse.json();

    if (finalJob.status === 'completed') {
      console.log('   ✅ Job completed successfully!\n');
      console.log('   🏆 Winner:', finalJob.result.winner.agentName);
      console.log('   📊 Score:', finalJob.result.winner.averageScore.toFixed(2));
      console.log('\n   📈 All Scores:');
      Object.entries(finalJob.result.scores).forEach(([id, score]: [string, any]) => {
        console.log(`      ${score.agentName}: ${score.averageScore.toFixed(2)}/10`);
        console.log(`         Votes: ${score.votes.length}`);
      });
      console.log('\n   💬 Discussion Summary:');
      console.log(`      Rounds: ${finalJob.result.discussionSummary.roundCount}`);
      console.log(
        `      Messages: ${finalJob.result.discussionSummary.totalMessages}`
      );
      console.log(
        `      Tool Calls: ${finalJob.result.discussionSummary.toolCallsUsed}`
      );
    } else if (finalJob.status === 'failed') {
      console.log('   ❌ Job failed:', finalJob.error);
    }

    // Test 4: Cleanup (optional)
    console.log('\n4️⃣  Cleanup...');
    console.log('   ℹ️  Job left in database for inspection');
    console.log(`   💡 To delete: DELETE ${baseUrl}/api/moe-vote/${jobId}\n`);

    console.log('✨ Integration test complete!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testMoeVoteWorkflow();
