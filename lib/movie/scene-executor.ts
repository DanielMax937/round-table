/**
 * Execute scene dialogue via agents - each character generates their lines turn by turn.
 * Director sends scene summary first, then agents reference it when generating dialogue.
 */

import { getSceneWithDialogue, updateScene } from '@/lib/db/scenes';
import { prisma } from '@/lib/prisma';
import { getAgentsByRoundTable } from '@/lib/db/agents';
import { createRound, getNextRoundNumber, completeRound } from '@/lib/db/rounds';
import { canStartNewRound } from '@/lib/db/roundtable';
import { createMessage, getAllMessagesForRoundTable } from '@/lib/db/messages';
import { executeRound } from '@/lib/agents/orchestrator';
import { synthesizeScript } from './synthesizer';
import { sendScriptToTelegramSeparateDialogues, sendTextToTelegram } from '@/lib/telegram';
import { generateDirectorSceneSummary } from './director-actor';
import type { DirectorActorInput } from './director-actor';
import {
  repairSceneScript,
  reviewSceneScript,
  type SceneScriptReviewInput,
  type SceneScriptReviewResult,
} from './script-reviewer';
import { parseScreenplayDialogue } from './script-parser';

export interface ExecuteSceneResult {
  sceneId: string;
  fullScript: string;
  messageCount: number;
  review: SceneScriptReviewResult;
  attempts: number;
  repaired?: boolean;
}

export interface ExecuteSceneProgress {
  phase: 'director' | 'rounds' | 'synthesizing' | 'reviewing' | 'repairing';
  roundNumber?: number;
  agentName?: string | null;
  attempt?: number;
}

const DEFAULT_MAX_REVIEW_ATTEMPTS = 3;
const DEFAULT_MAX_REPAIR_ATTEMPTS = 3;

/**
 * Execute scene: Director summary first, then agent rounds. Each line sent to Telegram.
 */
export async function executeSceneWithAgents(
  sceneId: string,
  options?: {
    header?: string;
    onProgress?: (progress: ExecuteSceneProgress) => Promise<void> | void;
  }
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

  await options?.onProgress?.({ phase: 'director' });
  const directorSummary = await generateDirectorSceneSummary(directorInput);
  await updateScene(sceneId, { contextJson: JSON.stringify({ directorSummary }) });

  const baseTopicWithDirector = `[导演场景概要]\n${directorSummary}\n\n---\n\n${roundTable.topic}`;

  const maxReviewAttempts = Number(process.env.SCENE_REVIEW_MAX_ATTEMPTS || DEFAULT_MAX_REVIEW_ATTEMPTS);
  let reviewFeedback = '';
  let lastReview: SceneScriptReviewResult | null = null;
  let lastScript = '';
  let lastMessages: Array<{ characterName: string; content: string; roundNumber: number }> = [];
  let lastSceneWithMessages: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>> | null = null;
  let lastTotalMessages = 0;
  await clearSceneDialogue(roundTable.id);

  for (let attempt = 1; attempt <= maxReviewAttempts; attempt++) {
    if (attempt > 1) {
      await clearSceneDialogue(roundTable.id);
    }

    const topicWithDirector = reviewFeedback
      ? `${baseTopicWithDirector}\n\n---\n\n# 上一版资深编剧评审反馈（本次必须修正）\n${reviewFeedback}`
      : baseTopicWithDirector;

    const totalMessages = await runDialogueAttempt({
      scene,
      agents,
      roundTable,
      topicWithDirector,
      apiKey,
      attempt,
      onProgress: options?.onProgress,
    });
    lastTotalMessages = totalMessages;

    const sceneWithMessages = await getSceneWithDialogue(sceneId);
    if (!sceneWithMessages?.roundTable.rounds.length) {
      throw new Error('No dialogue rounds to finalize');
    }

    const messages = sceneWithMessages.roundTable.rounds.flatMap((r) =>
      r.messages.map((msg) => ({
        characterName: msg.agent.name,
        content: msg.content,
        roundNumber: r.roundNumber,
      }))
    );
    lastMessages = messages;
    lastSceneWithMessages = sceneWithMessages;

    const input = {
      movieTitle: scene.movie.title,
      sceneHeading: scene.heading,
      sceneDescription: scene.description,
      characters: scene.sceneCharacters.map((sc) => ({
        name: sc.character.name,
        backstory: sc.character.backstory,
      })),
      messages,
      reviewFeedback: reviewFeedback || undefined,
    };

    await options?.onProgress?.({ phase: 'synthesizing', attempt });
    const { fullContent } = await synthesizeScript(input);
    lastScript = fullContent;

    await options?.onProgress?.({ phase: 'reviewing', attempt });
    const review = await reviewSceneScript({
      movieTitle: scene.movie.title,
      sceneHeading: scene.heading,
      sceneDescription: scene.description,
      emotionalGoal: scene.emotionalGoal || '',
      characters: scene.sceneCharacters.map((sc) => ({
        name: sc.character.name,
        backstory: sc.character.backstory,
        personalityTraits: sc.character.personalityTraits,
        surfaceGoal: sc.character.surfaceGoal,
        deepMotivation: sc.character.deepMotivation,
        fatalFlaw: sc.character.fatalFlaw,
        signatureLanguageStyle: sc.character.signatureLanguageStyle,
      })),
      rawDialogue: messages,
      script: fullContent,
      attempt,
    });
    lastReview = review;

    const context = {
      directorSummary,
      scriptReview: {
        attempts: attempt,
        passed: review.passed,
        score: review.score,
        aiFeel: review.aiFeel,
        summary: review.summary,
        issues: review.issues,
        rewriteInstructions: review.rewriteInstructions,
      },
    };
    await updateScene(sceneId, { contextJson: JSON.stringify(context) });

    if (!review.passed) {
      reviewFeedback = formatReviewFeedback(review);
      if (attempt < maxReviewAttempts) {
        console.warn(`[Scene Review] Attempt ${attempt} failed; regenerating scene ${sceneId}`);
        continue;
      }

      if (!lastSceneWithMessages) {
        throw new Error(`Scene script failed LLM review after ${attempt} attempt(s): ${reviewFeedback}`);
      }

      return await repairAndReviewFinalScript({
        scene,
        sceneWithMessages: lastSceneWithMessages,
        directorSummary,
        sourceScript: lastScript,
        sourceMessages: lastMessages,
        failedReview: review,
        attempt: attempt + 1,
        header: options?.header,
        totalMessages: lastTotalMessages,
        onProgress: options?.onProgress,
      });
    }

    await persistApprovedDialogueMemories(sceneWithMessages);
    await updateScene(sceneId, { finalizedScript: fullContent, status: 'draft' });
    await notifyHumanReview(options?.header, fullContent, review);

    return {
      sceneId,
      fullScript: fullContent,
      messageCount: totalMessages,
      review,
      attempts: attempt,
    };
  }

  throw new Error(
    `Scene script failed LLM review: ${lastReview ? formatReviewFeedback(lastReview) : 'unknown review error'}`
  );
}

async function repairAndReviewFinalScript(input: {
  scene: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>;
  sceneWithMessages: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>;
  directorSummary: string;
  sourceScript: string;
  sourceMessages: Array<{ characterName: string; content: string; roundNumber: number }>;
  failedReview: SceneScriptReviewResult;
  attempt: number;
  header?: string;
  totalMessages: number;
  onProgress?: (progress: ExecuteSceneProgress) => Promise<void> | void;
}): Promise<ExecuteSceneResult> {
  const maxRepairAttempts = Number(process.env.SCENE_REPAIR_MAX_ATTEMPTS || DEFAULT_MAX_REPAIR_ATTEMPTS);
  let currentScript = input.sourceScript;
  let currentMessages = input.sourceMessages;
  let currentReview = input.failedReview;
  let currentAttempt = input.attempt;

  for (let repairAttempt = 1; repairAttempt <= maxRepairAttempts; repairAttempt++) {
    currentAttempt = input.attempt + repairAttempt - 1;
    await input.onProgress?.({ phase: 'repairing', attempt: currentAttempt });

    const repairedScript = await repairSceneScript(
      buildReviewInput({
        scene: input.scene,
        messages: currentMessages,
        script: currentScript,
        attempt: currentAttempt - 1,
      }),
      currentReview
    );
    if (!repairedScript.trim()) {
      throw new Error('Scene script-doctor repair returned empty content');
    }

    const repairedDialogue = extractRawDialogueFromScript(repairedScript);
    await input.onProgress?.({ phase: 'reviewing', attempt: currentAttempt });
    const repairReview = await reviewSceneScript(
      buildReviewInput({
        scene: input.scene,
        messages: repairedDialogue.length ? repairedDialogue : currentMessages,
        script: repairedScript,
        attempt: currentAttempt,
      })
    );

    await updateScene(input.scene.id, {
      contextJson: JSON.stringify({
        directorSummary: input.directorSummary,
        scriptReview: {
          attempts: currentAttempt,
          repairAttempts: repairAttempt,
          repaired: true,
          passed: repairReview.passed,
          score: repairReview.score,
          aiFeel: repairReview.aiFeel,
          summary: repairReview.summary,
          issues: repairReview.issues,
          rewriteInstructions: repairReview.rewriteInstructions,
        },
      }),
    });

    if (repairReview.passed) {
      await persistScriptDialogueMemories(input.sceneWithMessages, repairedDialogue);
      await updateScene(input.scene.id, { finalizedScript: repairedScript, status: 'draft' });
      await notifyHumanReview(input.header, repairedScript, repairReview);

      return {
        sceneId: input.scene.id,
        fullScript: repairedScript,
        messageCount: input.totalMessages,
        review: repairReview,
        attempts: currentAttempt,
        repaired: true,
      };
    }

    currentScript = repairedScript;
    currentMessages = repairedDialogue.length ? repairedDialogue : currentMessages;
    currentReview = repairReview;
  }

  throw new Error(
    `Scene script failed LLM review after ${input.attempt - 1} generation attempt(s) and ${maxRepairAttempts} script-doctor repair attempt(s): ${formatReviewFeedback(currentReview)}`
  );
}

function buildReviewInput(input: {
  scene: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>;
  messages: Array<{ characterName: string; content: string; roundNumber: number }>;
  script: string;
  attempt: number;
}): SceneScriptReviewInput {
  return {
    movieTitle: input.scene.movie.title,
    sceneHeading: input.scene.heading,
    sceneDescription: input.scene.description,
    emotionalGoal: input.scene.emotionalGoal || '',
    characters: input.scene.sceneCharacters.map((sc) => ({
      name: sc.character.name,
      backstory: sc.character.backstory,
      personalityTraits: sc.character.personalityTraits,
      surfaceGoal: sc.character.surfaceGoal,
      deepMotivation: sc.character.deepMotivation,
      fatalFlaw: sc.character.fatalFlaw,
      signatureLanguageStyle: sc.character.signatureLanguageStyle,
    })),
    rawDialogue: input.messages,
    script: input.script,
    attempt: input.attempt,
  };
}

async function runDialogueAttempt(input: {
  scene: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>;
  agents: Awaited<ReturnType<typeof getAgentsByRoundTable>>;
  roundTable: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>['roundTable'];
  topicWithDirector: string;
  apiKey: string;
  attempt: number;
  onProgress?: (progress: ExecuteSceneProgress) => Promise<void> | void;
}): Promise<number> {
  let totalMessages = 0;

  for (let roundNum = 1; roundNum <= input.roundTable.maxRounds; roundNum++) {
    const canStart = await canStartNewRound(input.roundTable.id);
    if (!canStart) break;

    const roundNumber = await getNextRoundNumber(input.roundTable.id);
    const round = await createRound(input.roundTable.id, roundNumber);
    await input.onProgress?.({
      phase: 'rounds',
      roundNumber,
      agentName: null,
      attempt: input.attempt,
    });

    const previousMessages = (await getAllMessagesForRoundTable(input.roundTable.id)).map((msg) => ({
      ...msg,
      agent: input.agents.find((a) => a.id === msg.agentId)!,
    }));

    const characterIdByAgentId = buildCharacterIdByAgentId(input.scene, input.agents);
    const characterProfileByAgentId = buildCharacterProfileByAgentId(input.scene, input.agents);
    const movieContext = {
      movieId: input.scene.movie.id,
      characterIdByAgentId,
      characterProfileByAgentId,
      sceneContext: {
        heading: input.scene.heading,
        contentSummary: input.scene.contentSummary || input.scene.description || '',
        emotionalGoal: input.scene.emotionalGoal || '',
        maxRounds: input.roundTable.maxRounds,
      },
    };

    const roundResult = await executeRound(
      input.agents,
      input.topicWithDirector,
      roundNumber,
      previousMessages,
      {
        apiKey: input.apiKey,
        language: 'zh',
        toolsEnabled: false,
        movieContext,
        memoryWriteEnabled: false,
        onEvent: async (event) => {
          if (event.type === 'agent-start') {
            await input.onProgress?.({
              phase: 'rounds',
              roundNumber,
              agentName: event.data.agentName ?? null,
              attempt: input.attempt,
            });
          }
        },
      }
    );

    for (const m of roundResult.messages) {
      const agent = input.agents.find((a) => a.id === m.agentId);
      if (agent && m.content?.trim()) {
        await createMessage(round.id, m.agentId, m.content, m.toolCalls, m.citations);
        totalMessages++;
      }
    }

    await completeRound(round.id);
  }

  return totalMessages;
}

async function clearSceneDialogue(roundTableId: string): Promise<void> {
  await prisma.message.deleteMany({
    where: { round: { roundTableId } },
  });
  await prisma.round.deleteMany({
    where: { roundTableId },
  });
}

function buildCharacterIdByAgentId(
  scene: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>,
  agents: Awaited<ReturnType<typeof getAgentsByRoundTable>>
): Record<string, string> {
  const characterIdByAgentId: Record<string, string> = {};
  for (const sc of scene.sceneCharacters) {
    const agent = agents.find((a) => a.name === sc.character.name);
    if (agent) characterIdByAgentId[agent.id] = sc.character.id;
  }
  return characterIdByAgentId;
}

function buildCharacterProfileByAgentId(
  scene: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>,
  agents: Awaited<ReturnType<typeof getAgentsByRoundTable>>
): NonNullable<import('@/lib/types').MovieContext['characterProfileByAgentId']> {
  const characterProfileByAgentId: NonNullable<import('@/lib/types').MovieContext['characterProfileByAgentId']> = {};
  for (const sc of scene.sceneCharacters) {
    const agent = agents.find((a) => a.name === sc.character.name);
    if (!agent) continue;
    characterProfileByAgentId[agent.id] = {
      name: sc.character.name,
      backstory: sc.character.backstory,
      personalityTraits: sc.character.personalityTraits,
      surfaceGoal: sc.character.surfaceGoal,
      deepMotivation: sc.character.deepMotivation,
      fatalFlaw: sc.character.fatalFlaw,
      signatureLanguageStyle: sc.character.signatureLanguageStyle,
      currentStateJson: sc.character.currentStateJson,
    };
  }
  return characterProfileByAgentId;
}

async function persistApprovedDialogueMemories(
  scene: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>
): Promise<void> {
  const { addMessage, buildAddMessageUserContent } = await import('@/lib/memos/client');
  const agents = scene.roundTable.agents;
  const characterIdByAgentId = buildCharacterIdByAgentId(scene, agents);
  const sceneContext = {
    heading: scene.heading,
    contentSummary: scene.contentSummary || scene.description || '',
    emotionalGoal: scene.emotionalGoal || '',
  };

  for (const round of scene.roundTable.rounds) {
    const priorLines: Array<{ name: string; content: string }> = [];
    for (const msg of round.messages) {
      const characterId = characterIdByAgentId[msg.agentId];
      if (characterId && msg.content?.trim()) {
        const userContent = buildAddMessageUserContent(sceneContext, priorLines);
        await addMessage(characterId, scene.movieId, [
          { role: 'user', content: userContent },
          { role: 'assistant', content: msg.content.trim() },
        ]);
      }
      priorLines.push({ name: msg.agent.name, content: msg.content || '' });
    }
  }
}

async function persistScriptDialogueMemories(
  scene: NonNullable<Awaited<ReturnType<typeof getSceneWithDialogue>>>,
  dialogue: Array<{ characterName: string; content: string; roundNumber: number }>
): Promise<void> {
  if (!dialogue.length) {
    await persistApprovedDialogueMemories(scene);
    return;
  }

  const { addMessage, buildAddMessageUserContent } = await import('@/lib/memos/client');
  const characterIdByName = new Map(
    scene.sceneCharacters.map((sc) => [normalizeName(sc.character.name), sc.character.id])
  );
  const sceneContext = {
    heading: scene.heading,
    contentSummary: scene.contentSummary || scene.description || '',
    emotionalGoal: scene.emotionalGoal || '',
  };
  const priorLines: Array<{ name: string; content: string }> = [];

  for (const line of dialogue) {
    const characterId = characterIdByName.get(normalizeName(line.characterName));
    if (characterId && line.content.trim()) {
      const userContent = buildAddMessageUserContent(sceneContext, priorLines);
      await addMessage(characterId, scene.movieId, [
        { role: 'user', content: userContent },
        { role: 'assistant', content: line.content.trim() },
      ]);
    }
    priorLines.push({ name: line.characterName, content: line.content });
  }
}

function extractRawDialogueFromScript(
  script: string
): Array<{ characterName: string; content: string; roundNumber: number }> {
  const parsed = parseScreenplayDialogue(script);
  return parsed.dialogues
    .map((block, index) => ({
      characterName: block.character.trim(),
      content: stripSpeakerFromDialogue(block.character, block.content),
      roundNumber: index + 1,
    }))
    .filter((line) => line.characterName && line.content);
}

function stripSpeakerFromDialogue(character: string, content: string): string {
  const lines = content.split(/\r?\n/);
  const first = lines[0]?.trim() || '';
  const normalizedFirst = normalizeName(first.replace(/[（(].*?[）)]/g, ''));
  const normalizedCharacter = normalizeName(character);
  if (normalizedFirst === normalizedCharacter || normalizedFirst.startsWith(normalizedCharacter)) {
    return lines.slice(1).join('\n').trim();
  }
  return content.trim();
}

function normalizeName(name: string): string {
  return name
    .replace(/[：:]/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
}

async function notifyHumanReview(
  header: string | undefined,
  script: string,
  review: SceneScriptReviewResult
): Promise<void> {
  const reviewSummary = [
    '✅ LLM 编剧评审通过',
    `评分: ${review.score}/10`,
    `AI 感: ${review.aiFeel}`,
    review.summary ? `摘要: ${review.summary}` : null,
  ].filter(Boolean).join('\n');

  await sendTextToTelegram(reviewSummary).catch(() => {});
  await sendScriptToTelegramSeparateDialogues(script, { header }).catch(() => {});
}

function formatReviewFeedback(review: SceneScriptReviewResult): string {
  const issueText = review.issues.length ? review.issues.map((i) => `- ${i}`).join('\n') : '- 未列出具体问题';
  return [
    `评分: ${review.score}/10`,
    `AI 感: ${review.aiFeel}`,
    `总体评价: ${review.summary || '无'}`,
    '问题:',
    issueText,
    '重写指令:',
    review.rewriteInstructions || '请减少 AI 感、复读和角色串味。',
  ].join('\n');
}
