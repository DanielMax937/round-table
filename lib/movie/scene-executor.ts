/**
 * Execute scene dialogue via agents - each character generates their lines turn by turn.
 * Director sends scene summary first, then agents reference it when generating dialogue.
 */

import { getSceneWithDialogue, updateScene } from '@/lib/db/scenes';
import { getAgentsByRoundTable } from '@/lib/db/agents';
import { createRound, getNextRoundNumber, completeRound } from '@/lib/db/rounds';
import { canStartNewRound } from '@/lib/db/roundtable';
import { createMessage, getAllMessagesForRoundTable } from '@/lib/db/messages';
import { executeRound } from '@/lib/agents/orchestrator';
import { synthesizeScript } from './synthesizer';
import { sendTextToTelegram } from '@/lib/telegram';
import { generateDirectorSceneSummary } from './director-actor';
import type { DirectorActorInput } from './director-actor';

export interface ExecuteSceneResult {
  sceneId: string;
  fullScript: string;
  messageCount: number;
}

/**
 * Execute scene: Director summary first, then agent rounds. Each line sent to Telegram.
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

  // Director: generate scene summary before agents speak
  const directorInput: DirectorActorInput = {
    movieTitle: scene.movie.title,
    sceneHeading: scene.heading,
    contentSummary: scene.contentSummary || scene.description,
    emotionalGoal: scene.emotionalGoal || '',
    plotSummary: scene.movie.plotSummary || '',
    characters: scene.sceneCharacters.map((sc) => ({
      id: sc.character.id,
      name: sc.character.name,
      backstory: sc.character.backstory,
      personalityTraits: sc.character.personalityTraits,
      surfaceGoal: sc.character.surfaceGoal,
      deepMotivation: sc.character.deepMotivation,
      fatalFlaw: sc.character.fatalFlaw,
      signatureLanguageStyle: sc.character.signatureLanguageStyle,
      currentStateJson: sc.character.currentStateJson,
    })),
  };

  const directorSummary = await generateDirectorSceneSummary(directorInput);
  await sendTextToTelegram(`🎬 导演场景概要\n\n${directorSummary}`).catch(() => {});
  await updateScene(sceneId, { contextJson: JSON.stringify({ directorSummary }) });

  const topicWithDirector = `[导演场景概要]\n${directorSummary}\n\n---\n\n${roundTable.topic}`;

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
      topicWithDirector,
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
