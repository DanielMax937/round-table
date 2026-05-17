// Agent execution logic

import { Agent as AgentModel, Message } from '@prisma/client';
import { AgentContext, ToolCall } from '../types';
import type { MovieContext } from '../types';
import { performWebSearch, formatSearchResults } from './tools/websearch';
import { z } from 'zod';
import { streamChatCompletion } from '@/lib/llm/client';
import type { LLMMessage, LLMTool } from '@/lib/llm/types';
import { buildAgentSystemPrompt } from './config';
import type { AgentPersona } from '../personas';

// Web search tool definition for OpenAI function calling
const WEB_SEARCH_TOOL: LLMTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for current information, facts, or recent events. Use this to find supporting evidence for your arguments.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query terms',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * Build agent context from discussion history
 */
export function buildAgentContext(
  topic: string,
  roundNumber: number,
  previousMessages: (Message & { agent: AgentModel })[],
  currentRoundMessages: (Message & { agent: AgentModel })[]
): AgentContext {
  // Parse toolCalls from JSON string to object (safely)
  const safeParseToolCalls = (toolCalls: unknown): any[] | undefined => {
    if (!toolCalls || typeof toolCalls !== 'string' || toolCalls.trim() === '') {
      return undefined;
    }
    try {
      return JSON.parse(toolCalls);
    } catch {
      console.warn('Failed to parse toolCalls JSON:', toolCalls);
      return undefined;
    }
  };

  const mapMessage = (msg: Message & { agent: AgentModel }) => ({
    ...msg,
    toolCalls: safeParseToolCalls(msg.toolCalls)
  });

  return {
    topic,
    roundNumber,
    previousMessages: previousMessages.map(mapMessage),
    currentRoundMessages: currentRoundMessages.map(mapMessage),
  };
}

/**
 * Format messages for the Claude API
 * Converts database messages to Claude message format
 */
export function formatMessagesForClaude(
  context: AgentContext,
  currentAgentId: string,
  currentAgentName?: string,
  movieContext?: MovieContext
): any[] { // Using any[] to bypass SDK type mismatches for now
  const messages: any[] = [];

  // Add conversation history
  const allMessages = [...context.previousMessages, ...context.currentRoundMessages];
  const isScene = context.topic.includes('[Scene');
  const hasDirectorSummary = context.topic.includes('[导演场景概要]');
  const visibleMessages = isScene ? allMessages.slice(-18) : allMessages;

  for (const message of visibleMessages) {
    // Discussion agents should not see their own prior answer as a new opposing
    // message. Scene characters do need it so they remember what they already said.
    if (!isScene && message.agentId === currentAgentId) {
      continue;
    }

    const speakerLabel = isScene && message.agentId === currentAgentId
      ? `${message.agent.name}（你之前说过）`
      : message.agent.name;

    messages.push({
      role: 'user',
      content: `[${speakerLabel}]: ${message.content}`,
    });
  }

  // Add initial prompt for the first round
  if (context.roundNumber === 1 && messages.length === 0) {
    messages.push({
      role: 'user',
      content: isScene
        ? (hasDirectorSummary
            ? `请开始表演这场戏。**务必参考上方的导演场景概要**，把握本场走向和你角色的表现方向，以角色身份说出第一句台词。保持自然、简短（1-3句）。\n\n${context.topic}`
            : `请开始表演这场戏。根据场景描述和情感目标，以角色身份说出你的第一句台词。保持自然、简短（1-3句）。\n\n${context.topic}`)
        : `Please begin the discussion on: "${context.topic}"\n\nShare your perspective on this topic. Keep it natural and conversational - you're talking to real people here.`,
    });
  } else if (messages.length === 0) {
    messages.push({
      role: 'user',
      content: isScene
        ? (hasDirectorSummary
            ? `第 ${context.roundNumber} 轮。**参考导演场景概要**，根据之前的对话继续表演，自然回应其他角色。\n\n${context.topic}`
            : `第 ${context.roundNumber} 轮。根据之前的对话继续表演，自然回应其他角色。\n\n${context.topic}`)
        : `Round ${context.roundNumber}. Continue the discussion on: "${context.topic}"\n\nRespond naturally to what others have said. Don't repeat your old points - move the conversation forward.`,
    });
  }

  if (isScene && messages.length > 0) {
    const phaseInstruction = context.roundNumber <= 1
      ? '当前是开场轮：给出角色的第一反应或试探，不要提前总结道理。'
      : context.roundNumber === 2
        ? '当前是推进轮：必须带来一个新阻碍、新信息或更具体的要求。'
        : '当前已经进入收束轮：用态度变化、明确选择或关系转折结束这一 beat，不要继续辩论同一观点。';
    messages.push({
      role: 'user',
      content: [
        `现在轮到你${currentAgentName ? `（${currentAgentName}）` : ''}说下一句。`,
        phaseInstruction,
        '先承接上一句台词，但不要复述任何人已经表达过的观点、愧疚、安慰、解释或决定。',
        '这一句必须推进一个新的戏剧 beat：新信息、新选择、新阻碍、情绪转折、关系变化、具体要求或明确行动方向。',
        '优先回应本场的具体处境、关系和情感目标；不要把角色的长期目标硬塞进无关话题。',
        '少说抽象道理，多说此刻看得见、摸得着、会造成后果的具体人、物、数字、风险或动作。',
        '如果你已经说过同类意思，就换成回避、反问、打断、让步、升级冲突或转移话题。',
        '如果情感目标已经接近达成，就用一个明确的态度变化或决定收束，不要再展开新说理。',
        context.topic.includes('上一版资深编剧评审反馈')
          ? '这是重生成版本：必须逐条遵守上一版资深编剧评审反馈，禁止再出现反馈中点名的比喻、词、行为和 AI 腔。'
          : '',
        buildSceneTurnGuidance(context, currentAgentId, currentAgentName, movieContext),
        '不要说“场景、剧情、戏剧化、角色、台词”等元叙事词。',
        '不要使用动物比喻、农耕套话、鸡汤式金句或工整的总结句。',
        '只输出角色要说的台词本身，1-2句，不写角色名、旁白、动作说明或引号。'
      ].filter(Boolean).join('\n'),
    });
  }

  return messages;
}

/**
 * Parse tool use blocks from Claude response
 */
export function parseToolUseBlocks(
  content: any[]
): Array<{ toolUse: any; index: number }> {
  const toolUses: Array<{ toolUse: any; index: number }> = [];

  content.forEach((block, index) => {
    if (block.type === 'tool_use') {
      toolUses.push({ toolUse: block, index });
    }
  });

  return toolUses;
}

/**
 * Extract text content from Claude response
 */
export function extractTextContent(
  content: any[]
): string {
  const textBlocks = content
    .filter((block) => block.type === 'text')
    .map((block) => (block as any).text);

  return textBlocks.join('\n');
}

export interface ExecuteAgentTurnOptions {
  language?: 'en' | 'zh';
  toolsEnabled?: boolean;
  movieContext?: MovieContext;
}

export async function executeAgentTurn(
  agent: AgentModel,
  context: AgentContext,
  apiKey: string,
  options: ExecuteAgentTurnOptions | 'en' | 'zh' = {},
  onChunk?: (chunk: string) => void,
  onToolCall?: (toolCall: ToolCall) => void
): Promise<{ content: string; toolCalls: ToolCall[]; citations: Array<{ url: string; title: string; usedInContext?: boolean }> }> {
  const opts = typeof options === 'string' ? { language: options } : options;
  const language = opts.language;
  const toolsEnabled = opts.toolsEnabled ?? true;
  const movieContext = opts.movieContext;

  const formattedMessages = formatMessagesForClaude(context, agent.id, agent.name, movieContext);
  const toolCalls: ToolCall[] = [];
  let fullContent = '';

  // Build prompt from messages
  let promptContent = "";
  for (const m of formattedMessages) {
    if (typeof m.content === 'string') {
      promptContent += `${m.content}\n\n`;
    }
  }

  try {
    // Build system prompt using the agent's persona and the topic
    const agentPersona: AgentPersona = {
      name: agent.name,
      description: '', // Not needed for the prompt
      systemPrompt: agent.persona,
    };
    let systemPrompt = buildAgentSystemPrompt(agentPersona, context.topic, toolsEnabled);

    // MemOS: inject character memories before turn (AI Movie only)
    if (movieContext?.sceneContext) {
      const characterId = movieContext.characterIdByAgentId[agent.id];
      if (characterId) {
        const { searchMemory, buildSearchQuery, formatMemoriesForPrompt } = await import(
          '@/lib/memos/client'
        );
        const agentCount = Object.keys(movieContext.characterIdByAgentId).length;
        const prevRoundMessages = context.previousMessages.slice(-agentCount);
        const prevRoundSummary = prevRoundMessages
          .map((m) => {
            const c = (m.content || '').slice(0, 50);
            return `${m.agent.name}: ${c}${(m.content?.length ?? 0) > 50 ? '...' : ''}`;
          })
          .join('; ');
        const query = buildSearchQuery(movieContext.sceneContext, prevRoundSummary);
        const memories = await searchMemory(characterId, movieContext.movieId, query);
        const formatted = formatMemoriesForPrompt(memories);
        if (formatted) {
          systemPrompt += `\n\n# 角色记忆（与本场相关）\n<memories>\n${formatted}\n</memories>`;
        }
      }
    }

    // Add language instruction
    if (language === 'zh') {
      systemPrompt += '\n\nIMPORTANT: You MUST respond in Chinese (中文). All your responses should be in Chinese, including analysis, arguments, and conclusions.';
    } else if (language === 'en') {
      systemPrompt += '\n\nIMPORTANT: You MUST respond in English. All your responses should be in English.';
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptContent },
    ];

    const tools = toolsEnabled ? [WEB_SEARCH_TOOL] : [];
    console.log(`[Agent ${agent.name}] Starting turn${tools.length ? ' with web_search tool' : ' (no tools)'}`);

    // First call - may result in tool calls when tools enabled
    let stream = streamChatCompletion(messages, { tools });
    let pendingToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        fullContent += chunk.delta;
        onChunk?.(chunk.delta);
      } else if (chunk.type === 'tool_call_complete' && chunk.toolCall) {
        pendingToolCalls.push({
          id: chunk.toolCall.id,
          name: chunk.toolCall.function.name,
          arguments: chunk.toolCall.function.arguments,
        });
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
    }

    // Process tool calls if any
    if (pendingToolCalls.length > 0) {
      console.log(`[Agent ${agent.name}] LLM requested ${pendingToolCalls.length} tool call(s)`);

      for (const tc of pendingToolCalls) {
        if (tc.name === 'web_search') {
          try {
            const args = JSON.parse(tc.arguments);
            const query = args.query;

            console.log(`[Agent ${agent.name}] 🔍 Executing web_search with query: "${query}"`);

            const searchResults = await performWebSearch(query);
            const formattedResults = formatSearchResults(searchResults);

            console.log(`[Agent ${agent.name}] 📊 Web search returned ${searchResults.length} results:`);
            searchResults.slice(0, 3).forEach((r, i) => {
              console.log(`  [${i + 1}] ${r.title} - ${r.url}`);
            });

            // Create tool call record
            const toolCallRecord: ToolCall = {
              type: 'web_search',
              query,
              results: searchResults,
              timestamp: new Date(),
            };
            toolCalls.push(toolCallRecord);
            onToolCall?.(toolCallRecord);

            // Add assistant message with tool call and tool result to messages
            messages.push({
              role: 'assistant',
              content: '',
              tool_calls: [{
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              }],
            });

            messages.push({
              role: 'tool',
              content: formattedResults,
              tool_call_id: tc.id,
            });

          } catch (error) {
            console.error(`[Agent ${agent.name}] ❌ Web search failed:`, error);
            // Add error response
            messages.push({
              role: 'assistant',
              content: '',
              tool_calls: [{
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              }],
            });
            messages.push({
              role: 'tool',
              content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              tool_call_id: tc.id,
            });
          }
        }
      }

      // Continue conversation after tool calls
      console.log(`[Agent ${agent.name}] Continuing after tool calls...`);
      stream = streamChatCompletion(messages, { tools });

      for await (const chunk of stream) {
        if (chunk.type === 'content_delta' && chunk.delta) {
          fullContent += chunk.delta;
          onChunk?.(chunk.delta);
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error || 'LLM streaming error');
        }
      }
    } else {
      console.log(`[Agent ${agent.name}] ℹ️ LLM did not use web_search tool`);
    }

    if (movieContext?.sceneContext) {
      fullContent = sanitizeSceneDialogueOutput(fullContent, agent.name);
    }

    // Extract citations from content and search results
    const { extractCitations } = await import('./citations');
    const allSearchResults = toolCalls.flatMap(tc => tc.results || []);

    const citations = extractCitations(fullContent, allSearchResults);

    return {
      content: fullContent,
      toolCalls,
      citations,
    };
  } catch (error) {
    console.error(`Error executing agent ${agent.name}:`, error);
    throw error;
  }
}

function buildSceneTurnGuidance(
  context: AgentContext,
  currentAgentId: string,
  currentAgentName?: string,
  movieContext?: MovieContext
): string {
  if (!movieContext?.sceneContext) return '';

  const allMessages = [...context.previousMessages, ...context.currentRoundMessages];
  const ownLines = allMessages.filter((m) => m.agentId === currentAgentId).map((m) => m.content || '');
  const latestOther = [...allMessages].reverse().find((m) => m.agentId !== currentAgentId);
  const profile = movieContext.characterProfileByAgentId?.[currentAgentId];
  const roundCount = movieContext.sceneContext.maxRounds || 3;
  const sceneStage = context.roundNumber <= 1
    ? '试探：别急着解释，先保护面子或测试对方。'
    : context.roundNumber >= roundCount
      ? '收束：用一个具体决定、退让、拒绝或关系变化结束这个 beat。'
      : '加压：把上一句变成更具体的要求、风险、旧账或选择。';
  const tactic = chooseHumanTactic(context.roundNumber, ownLines.length, currentAgentName || profile?.name || '');
  const profileLines = [
    profile?.surfaceGoal ? `长期压力只作潜台词：${profile.surfaceGoal}` : null,
    profile?.deepMotivation ? `藏起来的真正需求：${profile.deepMotivation}` : null,
    profile?.fatalFlaw ? `本能防御/缺陷：${profile.fatalFlaw}` : null,
    profile?.signatureLanguageStyle ? `语言习惯：${profile.signatureLanguageStyle}` : null,
    profile?.currentStateJson ? `当前状态：${summarizeCurrentState(profile.currentStateJson)}` : null,
  ].filter(Boolean);
  const ownLineText = ownLines.slice(-3).map((line) => `- ${line}`).join('\n');

  return [
    '# 本轮真人化表演指令',
    `当前阶段：${sceneStage}`,
    latestOther ? `上一句来自 ${latestOther.agent.name}：${truncate(latestOther.content || '', 140)}` : '这是你在本场第一次开口。',
    profileLines.length ? profileLines.join('\n') : '',
    ownLineText ? `你最近已经说过，不能换个说法重复：\n${ownLineText}` : '',
    `这一句的打法：${tactic}`,
    '先在心里回答三个问题，但不要写出来：我现在想让对方做什么？我怕什么被看穿？我能抓住眼前哪个具体东西或细节？',
    '说话要有社交摩擦：可以答非所问、压低声音、抢半句、突然改口、用称呼刺人、把问题推回去，或用一个具体动作逼对方反应。',
    '不要使用“别闹了、坐下、继续、你不懂、我知道、相信我”这类万能句，除非同时说出具体代价、具体物件或马上要发生的后果。',
    '坏例子：妈，别闹了，坐下继续吃饭。好例子：妈，你再问他工资，明天财经版写的就不是并购，是我把相亲当路演。',
    '禁止输出完整观点陈述、价值观总结、自我心理剖析或“我明白/我理解/我们应该”式的软总结。'
  ].filter(Boolean).join('\n');
}

function chooseHumanTactic(roundNumber: number, ownLineCount: number, seed: string): string {
  const tactics = roundNumber <= 1
    ? [
        '用一个具体观察开口，不解释立场；让对方感到被看见或被冒犯。',
        '先回避真正问题，只抓住桌上/屋里/对方身上的一个细节。',
        '用短句试探对方底线，不要把话说满。',
      ]
    : [
        '不要回答表面问题，逼对方做一个眼前选择。',
        '抓住上一句里的漏洞，用更具体的事实、钱、时间、身份或旧事压过去。',
        '先让一步，再用一句更刺的真话把压力推回去。',
        '把情绪藏在实际动作里：要求坐下、拿东西、签字、关门、付款、删消息或离开。',
        '用一句不完整的话或反问制造停顿，不要解释自己的动机。',
      ];
  const charSum = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return tactics[(charSum + roundNumber + ownLineCount) % tactics.length];
}

function summarizeCurrentState(currentStateJson: string): string {
  try {
    const state = JSON.parse(currentStateJson) as {
      emotionalState?: string;
      physicalState?: string;
      knowledge?: string[];
    };
    return [
      state.emotionalState ? `情绪=${state.emotionalState}` : null,
      state.physicalState ? `身体=${state.physicalState}` : null,
      Array.isArray(state.knowledge) && state.knowledge.length
        ? `知道=${state.knowledge.slice(0, 3).join('; ')}`
        : null,
    ].filter(Boolean).join('；') || currentStateJson;
  } catch {
    return truncate(currentStateJson, 180);
  }
}

function sanitizeSceneDialogueOutput(content: string, agentName: string): string {
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```(?:\w+)?\s*/i, '').replace(/```$/i, '').trim();
  cleaned = cleaned.replace(new RegExp(`^\\s*${escapeRegExp(agentName)}\\s*[：:]\\s*`), '').trim();
  cleaned = cleaned.replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
  cleaned = cleaned
    .split(/\r?\n/)
    .filter((line) => !/^\s*(旁白|动作|内心|说明|作为|注释)[：:]/.test(line))
    .join('\n')
    .trim();
  return cleaned || content.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}


/**
 * Execute agent turn without streaming (for testing or batch operations)
 */
export async function executeAgentTurnSimple(
  agent: AgentModel,
  context: AgentContext,
  apiKey: string
): Promise<{ content: string; toolCalls: ToolCall[]; citations: Array<{ url: string; title: string; usedInContext?: boolean }> }> {
  let content = '';
  const toolCalls: ToolCall[] = [];
  let citations: Array<{ url: string; title: string; usedInContext?: boolean }> = [];

  const result = await executeAgentTurn(
    agent,
    context,
    apiKey,
    undefined, // language - use default
    (chunk) => {
      content += chunk;
    },
    (toolCall) => {
      toolCalls.push(toolCall);
    }
  );

  return {
    content: result.content,
    toolCalls: result.toolCalls,
    citations: result.citations,
  };
}
