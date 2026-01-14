// Test script for async discussion API

async function testAsyncDiscussion() {
    console.log('🧪 Testing Async Discussion API\n');

    // Step 1: Create job
    console.log('1️⃣ Creating discussion job...');
    const createResponse = await fetch('http://localhost:3002/api/discussion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            topic: 'The future of renewable energy',
            agentCount: 2,
            maxRounds: 2,
            selectedPersonaIds: [
                'cmkcufylk0000127bwbg6zl0i', // Devil's Advocate
                'cmkcufylm0001127btxqc37oy', // The Optimist
            ],
        }),
    });

    if (!createResponse.ok) {
        console.error('❌ Failed to create job:', await createResponse.text());
        return;
    }

    const { jobId, roundTableId } = await createResponse.json();
    console.log(`✅ Job created: ${jobId}`);
    console.log(`   Round table: ${roundTableId}\n`);

    // Step 2: Poll for status
    console.log('2️⃣ Polling for status...\n');
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 3 minutes (60 * 3s)

    while (pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        pollCount++;

        const statusResponse = await fetch(`http://localhost:3002/api/discussion/${jobId}`);
        if (!statusResponse.ok) {
            console.error('❌ Failed to get status:', await statusResponse.text());
            break;
        }

        const status = await statusResponse.json();

        // Display status
        const timestamp = new Date().toLocaleTimeString();
        let statusLine = `[${timestamp}] Status: ${status.status}`;

        if (status.progress) {
            statusLine += ` | Round ${status.progress.currentRound}/${status.progress.totalRounds}`;
            if (status.progress.phase) {
                statusLine += ` (${status.progress.phase})`;
            }
        }

        console.log(statusLine);

        if (status.roundTable && status.roundTable.rounds) {
            console.log(`   Rounds completed: ${status.roundTable.rounds.filter((r: any) => r.status === 'completed').length}/${status.maxRounds}`);
            console.log(`   Total messages: ${status.roundTable.rounds.reduce((sum: number, r: any) => sum + r.messageCount, 0)}`);
        }

        // Check if complete
        if (status.status === 'completed') {
            console.log('\n✅ Discussion completed successfully!');
            console.log('\n📊 Final Results:');
            console.log(`   Topic: ${status.topic}`);
            console.log(`   Total Rounds: ${status.roundTable.rounds.length}`);
            console.log(`   Total Messages: ${status.roundTable.rounds.reduce((sum: number, r: any) => sum + r.messageCount, 0)}`);
            console.log(`   Duration: ${Math.round((new Date(status.completedAt).getTime() - new Date(status.createdAt).getTime()) / 1000)}s`);
            console.log(`\n   View at: http://localhost:3002/roundtable/${roundTableId}`);
            break;
        } else if (status.status === 'failed') {
            console.error('\n❌ Discussion failed:', status.error);
            break;
        }
    }

    if (pollCount >= maxPolls) {
        console.log('\n⏱️  Polling timeout - job still running');
    }
}

// Run test
testAsyncDiscussion().catch(console.error);
