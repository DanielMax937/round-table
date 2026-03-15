/**
 * Execute scene dialogue via agents - each character generates their lines turn by turn.
 * Sends each line to Telegram as it's generated.
 */

import { getSceneWithDialogue, updateScene } from '@/lib/db/scenes';
import { getAgentsByRoundTable } from '@/lib/db/agents';
import { createRound, getNextRoundNumber, completeRound } from '@/lib/db/rounds';
import { canStartNewRound } from '@/lib/db/roundtable';
import { createMessage, getAllMessagesForRoundTable } from '@/lib/db/messages';
import { executeRound } from '@/lib/agents/orchestrator';
import { synthesizeScript } from './synthesizer';
import { sendTextToTelegram } from '@/lib/telegram';

export interface ExecuteSceneResult {
  sceneId: string;
  fullScript: string;
  messageCount: number;
}

/**
 * Execute scene: run agent rounds, send each line to Telegram, synthesize to screenplay.
 */
export async function executeSceneWithAgents(
  sceneId: string,
  options?: { header?: string }
): Promise<ExecuteSceneResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const scene = await getSceneWithDialogue(sceneId);
  if (!scene) {
    throw new Error('Scene not found');
  }

  const { roundTable } = scene;
  const agents = await getAgentsByRoundTable(roundTable.id);
  if (agents.length === 0) {
    throw new Error('Scene has no agents');
  }

  if (options?.header) {
    await sendTextToTelegram(options.header).catch(() => {});
  }

  let totalMessages = 0;

  for (let roundNum = 1; roundNum <= roundTable.maxRounds; roundNum++) {
    const canStart = await canStartNewRound(roundTable.id);
    if (!canStart) break;

    const roundNumber = await getNextRoundNumber(roundTable.id);
    const round = await createRound(roundTable.id, roundNumber);

    const previousMessages = (await getAllMessagesForRoundTable(roundTable.id)).map((msg) => ({
      ...msg,
      agent: agents.find((a) => a.id === msg.agentId)!,
    }));

    const roundResult = await executeRound(
      agents,
      roundTable.topic,
      roundNumber,
      previousMessages,
      { apiKey, language: 'zh', toolsEnabled: false }
    );

    // Save messages and send each line to Telegram
    for (const m of roundResult.messages) {
      const agent = agents.find((a) => a.id === m.agentId);
      if (agent && m.content?.trim()) {
        await createMessage(round.id, m.agentId, m.content, m.toolCalls, m.citations);
        totalMessages++;
        await sendTextToTelegram(`${agent.name}: ${m.content}`).catch(() => {});
      }
    }

    await completeRound(round.id);
  }

  // Synthesize dialogue into screenplay format
  const sceneWithMessages = await getSceneWithDialogue(sceneId);
  if (!sceneWithMessages?.roundTable.rounds.length) {
    throw new Error('No dialogue rounds to finalize');
  }

  const input = {
    movieTitle: scene.movie.title,
    sceneHeading: scene.heading,
    sceneDescription: scene.description,
    characters: scene.sceneCharacters.map((sc) => ({
      name: sc.character.name,
      backstory: sc.character.backstory,
    })),
    messages: sceneWithMessages.roundTable.rounds.flatMap((r) =>
      r.messages.map((msg) => ({
        characterName: msg.agent.name,
        content: msg.content,
        roundNumber: r.roundNumber,
      }))
    ),
  };

  const { fullContent } = await synthesizeScript(input);
  await updateScene(sceneId, { finalizedScript: fullContent, status: 'draft' });

  return {
    sceneId,
    fullScript: fullContent,
    messageCount: totalMessages,
  };
}
