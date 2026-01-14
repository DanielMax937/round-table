
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkJob() {
    const jobId = process.argv[2];
    if (!jobId) {
        console.log('Please provide a jobId');
        return;
    }

    const job = await prisma.moeVoteJob.findUnique({
        where: { id: jobId },
        include: { roundTable: true }
    });

    if (!job) {
        console.log('Job not found');
        return;
    }

    console.log(`Job Status: ${job.status}`);
    console.log(`Round Table: ${job.roundTableId}`);
    console.log(`Max Rounds: ${job.roundTable.maxRounds}`);
    console.log(`Job Error: ${job.error || 'None'}`);
    console.log(`Job Result: ${job.result ? JSON.stringify(JSON.parse(job.result), null, 2) : 'None'}`);

    const messages = await prisma.message.findMany({
        where: {
            round: {
                roundTableId: job.roundTableId
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Total Messages: ${messages.length}`);
    messages.forEach(m => {
        console.log(`- [${m.createdAt.toISOString()}] ${m.agentId}: ${m.content.substring(0, 50)}...`);
    });
}

checkJob()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
