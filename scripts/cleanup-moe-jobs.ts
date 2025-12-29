import { cleanupOldJobs, cleanupStaleJobs } from '@/lib/moe-vote/cleanup';
import { prisma } from '@/lib/prisma';

async function cleanup() {
  console.log('🧹 Cleaning up MoE vote jobs...\n');

  try {
    // Clean up stale jobs
    console.log('1️⃣  Marking stale running jobs as failed...');
    const staleCount = await cleanupStaleJobs();
    console.log(`   ✅ Marked ${staleCount} stale job(s) as failed\n`);

    // Clean up old jobs
    console.log('2️⃣  Deleting old completed/failed jobs...');
    const oldCount = await cleanupOldJobs();
    console.log(`   ✅ Deleted ${oldCount} old job(s)\n`);

    console.log('✨ Cleanup complete!\n');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
