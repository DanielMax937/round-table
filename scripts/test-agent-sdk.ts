
import { query } from '@anthropic-ai/claude-agent-sdk';

async function main() {
    console.log('Starting SDK tool execution test...');

    try {
        const stream = query({
            prompt: "Calculate 12345 * 67890 using the tool.",
            options: {
                verbose: true,
                includePartialMessages: true, // Enable token streaming
                tools: [
                    {
                        name: "calculator",
                        description: "Calculate numbers. Use this tool for any math.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                a: { type: "number" },
                                b: { type: "number" },
                                op: { type: "string", enum: ["multiply"] } // constrained to force usage
                            },
                            required: ["a", "b", "op"]
                        },
                        execute: async (args: any) => {
                            console.log('>>> TOOL EXECUTED with:', args);
                            const result = args.a * args.b;
                            return { result };
                        }
                    }
                ]
            }
        });

        for await (const message of stream) {
            if (message.type === 'assistant') {
                // Log partial content if available
                // message.message.content might be array of blocks
                // We look for partial events
                // Actually, let's just log the type to see what we get
                // console.log('Event:', message.type);
            } else {
                console.log('Event:', message.type);
            }

            // If we see tool use in output, log it
            if (message.type === 'tool_use' || message.type === 'tool_result') { // Guessing types
                console.log('Tool Event:', message);
            }
        }
    } catch (err) {
        console.error('Error during query:', err);
    }
}

main();
