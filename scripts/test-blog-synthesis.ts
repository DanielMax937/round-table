import { synthesizeBlogPost } from '../lib/blog/synthesizer';

async function testSynthesis() {
  const input = {
    topic: "The Future of AI",
    messages: [
      {
        agentName: "Devil's Advocate",
        content: "AI poses significant risks...",
        roundNumber: 1
      },
      {
        agentName: "The Optimist",
        content: "AI will revolutionize healthcare...",
        roundNumber: 1
      }
    ]
  };

  console.log('Starting synthesis...\n');

  for await (const event of synthesizeBlogPost(input, process.env.ANTHROPIC_API_KEY!)) {
    if (event.type === 'chunk') {
      process.stdout.write(event.data.chunk || '');
    } else {
      console.log(`\n[${event.type}]`, event.data);
    }
  }
}

testSynthesis().catch(console.error);
