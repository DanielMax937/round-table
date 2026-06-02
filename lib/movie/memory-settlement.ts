import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { CharacterState } from './types';

interface CharacterForSettlement {
  id: string;
  name: string;
  currentStateJson?: string | null;
}

export interface SettlementResult {
  plotSummaryAddition: string;
  characterStateUpdates: Record<string, CharacterState>;
}

export async function settleMemory(
  sceneScript: string,
  sceneContext: {
    sceneHeading: string;
    contentSummary: string;
    emotionalGoal: string;
    characters: CharacterForSettlement[];
  },
  previousPlotSummary: string
): Promise<SettlementResult> {
  const charList = sceneContext.characters.map(c => c.name).join(', ');

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `You are a story analyst. After a scene is completed, extract:
1. A brief plot summary addition (2-4 sentences): what happened, key revelations, changes
2. For each character in the scene, their updated state: emotionalState, physicalState, knowledge (new facts they learned)

Output ONLY valid JSON:
{"plotSummaryAddition":"...","characterStates":{"CharacterName":{"emotionalState":"...","physicalState":"...","knowledge":["..."]}}}
Use exact character names as keys.`,
    },
    {
      role: 'user',
      content: `Scene: ${sceneContext.sceneHeading}
Goal: ${sceneContext.emotionalGoal}
Summary: ${sceneContext.contentSummary}
Characters: ${charList}

Previous plot summary: ${previousPlotSummary || '(none)'}

Scene script:
---
${sceneScript}
---

Extract plot addition and character state updates:`,
    },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.5, maxTokens: 1024 });
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = parseSettlementJson(cleaned, sceneContext);

  const plotSummaryAddition = String(parsed.plotSummaryAddition ?? '').trim();
  const characterStateUpdates: Record<string, CharacterState> = {};

  if (parsed.characterStates && typeof parsed.characterStates === 'object') {
    for (const [name, state] of Object.entries(parsed.characterStates)) {
      if (state && typeof state === 'object') {
        characterStateUpdates[name] = {
          emotionalState: state.emotionalState,
          physicalState: state.physicalState,
          knowledge: Array.isArray(state.knowledge) ? state.knowledge : [],
        };
      }
    }
  }

  return { plotSummaryAddition, characterStateUpdates };
}

function parseSettlementJson(
  value: string,
  sceneContext: {
    sceneHeading: string;
    contentSummary: string;
    emotionalGoal: string;
  }
): {
  plotSummaryAddition?: string;
  characterStates?: Record<string, { emotionalState?: string; physicalState?: string; knowledge?: string[] }>;
} {
  if (!value) {
    return fallbackSettlement(sceneContext);
  }

  try {
    return JSON.parse(value);
  } catch {
    const objectMatch = value.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through to a deterministic fallback so scene confirmation is not blocked.
      }
    }
  }

  return fallbackSettlement(sceneContext);
}

function fallbackSettlement(sceneContext: {
  sceneHeading: string;
  contentSummary: string;
  emotionalGoal: string;
}) {
  return {
    plotSummaryAddition: [
      sceneContext.sceneHeading,
      sceneContext.contentSummary,
      sceneContext.emotionalGoal ? `情绪目标：${sceneContext.emotionalGoal}` : null,
    ].filter(Boolean).join('。'),
    characterStates: {},
  };
}
