// Test script to verify citation extraction and storage
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCitations() {
    try {
        console.log('🧪 Starting citation test...\n');

        // Get first two personas
        const personas = await prisma.persona.findMany({ take: 2 });

        if (personas.length < 2) {
            console.error('❌ Need at least 2 personas in database');
            process.exit(1);
        }

        // Create round table
        console.log('📝 Creating round table...');
        const roundTable = await prisma.roundTable.create({
            data: {
                topic: 'What are the latest breakthroughs in quantum computing announced this month?',
                agentCount: 2,
                maxRounds: 3,
                selectedAgentIds: personas.map(p => p.id),
            },
        });

        console.log(`✅ Created round table: ${roundTable.id}\n`);

        // Start round via API
        console.log('🚀 Starting round via API call...');
        console.log(`   URL: http://localhost:3002/api/roundtable/${roundTable.id}/round`);
        console.log('   (Check server logs for citation debug output)');
        console.log('\n⏳ Waiting for round to complete... (this may take 60-90 seconds)\n');

        const response = await fetch(`http://localhost:3002/api/roundtable/${roundTable.id}/round`, {
            method: 'POST',
        });

        if (!response.ok) {
            console.error('❌ Round failed:', await response.text());
            process.exit(1);
        }

        // Read the stream but don't process it
        const reader = response.body?.getReader();
        if (reader) {
            while (true) {
                const { done } = await reader.read();
                if (done) break;
            }
        }

        console.log('\n✅ Round completed!\n');

        // Check database for citations
        console.log('🔍 Checking database for citations...\n');

        const messages = await prisma.message.findMany({
            where: { round: { roundTableId: roundTable.id } },
            orderBy: { createdAt: 'asc' },
            include: { agent: true },
        });

        for (const msg of messages) {
            const citations = msg.citations ? JSON.parse(msg.citations as string) : [];
            console.log(`📧 Message from ${msg.agent.name}:`);
            console.log(`   Content length: ${msg.content.length} chars`);
            console.log(`   Citations: ${citations.length} found`);

            if (citations.length > 0) {
                console.log(`   ✅ Citations saved successfully:`);
                citations.slice(0, 3).forEach((c: any, i: number) => {
                    console.log(`      ${i + 1}. ${c.title}`);
                });
            } else {
                console.log(`   ❌ No citations saved (but check server logs for extraction)`);
            }
            console.log('');
        }

        console.log('\n🏁 Test complete!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testCitations();
