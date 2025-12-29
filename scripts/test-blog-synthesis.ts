import { synthesizeBlogPost } from '../lib/blog/synthesizer';

async function testSynthesis() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Please set it in your .env file or export it in your shell.');
    process.exit(1);
  }

  const input = {
    topic: "The Future of AI",
    messages: [
      {
        agentName: "Devil's Advocate",
        content: "While AI promises transformative benefits, we must confront uncomfortable truths about its risks. The concentration of AI power in a few tech giants creates dangerous monopolies that could reshape society without democratic oversight. We're rushing toward automation without addressing massive job displacement, and the potential for AI-powered surveillance threatens fundamental human freedoms. History shows us that powerful technologies often have unintended consequences, and AI's black-box decision-making raises serious accountability concerns.",
        roundNumber: 1
      },
      {
        agentName: "The Optimist",
        content: "AI will revolutionize healthcare by enabling earlier disease detection, personalized treatments, and drug discovery at unprecedented speeds. Climate change solutions will accelerate as AI optimizes renewable energy systems and models complex environmental interactions. Education will become truly personalized, adapting to each student's learning style and pace. The productivity gains from AI assistance will free humans to focus on creative, meaningful work rather than repetitive tasks.",
        roundNumber: 1
      },
      {
        agentName: "The Pragmatist",
        content: "The reality lies between utopia and dystopia. We need robust regulatory frameworks now, before AI capabilities outpace our ability to govern them. Investment in workforce retraining is essential, not optional. Public-private partnerships can balance innovation with accountability. The key is implementing AI gradually, measuring outcomes, and adjusting course based on evidence rather than hype or fear.",
        roundNumber: 2
      }
    ]
  };

  console.log('Starting synthesis...\n');

  for await (const event of synthesizeBlogPost(input, process.env.ANTHROPIC_API_KEY)) {
    if (event.type === 'chunk') {
      process.stdout.write(event.data.chunk || '');
    } else {
      console.log(`\n[${event.type}]`, event.data);
    }
  }
}

testSynthesis().catch(console.error);
