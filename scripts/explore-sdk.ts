
import * as AgentSDK from '@anthropic-ai/claude-agent-sdk';

console.log('Agent SDK Exports:', Object.keys(AgentSDK));

// Try to inspect the type of main exports if possible (runtime only)
try {
    // @ts-ignore
    if (AgentSDK.Agent) console.log('Found Agent class');
    // @ts-ignore
    if (AgentSDK.createSession) console.log('Found createSession');
    // @ts-ignore
    if (AgentSDK.query) console.log('Found query');
} catch (e) {
    console.error(e);
}
