import { streamChatCompletion } from '../lib/llm/client';

async function testOpenAI() {
    console.log('Testing OpenAI client...\n');

    console.log('Environment:');
    console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'NOT SET');
    console.log('  OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL || 'default');
    console.log('  OPENAI_MODEL_NAME:', process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo');
    console.log('');

    const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Say hello in one sentence.' }
    ];

    try {
        console.log('Sending request...\n');
        let fullResponse = '';

        const stream = streamChatCompletion(messages);

        for await (const chunk of stream) {
            if (chunk.type === 'content_delta') {
                process.stdout.write(chunk.delta);
                fullResponse += chunk.delta;
            } else if (chunk.type === 'error') {
                console.error('\n\n❌ Error:', chunk.error);
                return;
            } else if (chunk.type === 'done') {
                console.log('\n\n✅ Stream completed');
            }
        }

        console.log('\nFull response length:', fullResponse.length);
        console.log('Full response:', fullResponse);

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

testOpenAI();
