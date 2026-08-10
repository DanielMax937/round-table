import { describe, expect, it } from 'vitest';

import {
  VIDEO_PROMPT_MODE_OPTIONS,
  getVideoPromptModeLabel,
  normalizeVideoPromptMode,
} from '../video-prompt-mode-contract';
import { buildHiggsfieldPromptContext } from '../higgsfield-prompt-context';
import { buildSeedancePromptMessages } from '../seedance-prompt-compiler';
import { buildVideoPromptMessages } from '../video-prompt-modes';
import { normalizeVideoGenerationRequest } from '../video-assets';
import { normalizeProductionPipelineRequest } from '../production-pipeline';

const baseInput = {
  movieTitle: 'Mode Test',
  storyContext: '两名少年在雨夜博物馆中发现一件危险文物。',
  visualTitle: 'Museum keyframe',
  visualType: 'keyframe',
  characters: 'Roko, Lulu',
  requestedDurationSeconds: 10,
  ratio: '16:9',
  sceneText: 'Scene: Museum Hall\nDialogue: “别碰它。”',
  visualPrompt: 'Two teenagers beside a sealed glass case.',
  visualResult: 'Reference render completed.',
  notes: '保持人物身份和展柜位置。',
  sourceImagePaths: ['/tmp/character.png', '/tmp/location.png'],
};

describe('video prompt mode contract', () => {
  it('exposes exactly three user-selectable modes', () => {
    expect(VIDEO_PROMPT_MODE_OPTIONS.map((option) => option.value)).toEqual([
      'classic',
      'higgsfield',
      'hybrid',
    ]);
  });

  it('keeps classic as the backwards-compatible default', () => {
    expect(normalizeVideoPromptMode(undefined)).toBe('classic');
    expect(normalizeVideoPromptMode('unknown')).toBe('classic');
    expect(normalizeVideoPromptMode('higgsfield')).toBe('higgsfield');
    expect(normalizeVideoPromptMode('hybrid')).toBe('hybrid');
    expect(getVideoPromptModeLabel(undefined)).toBe('经典模式');
  });

  it('propagates the selected mode through manual and pipeline request normalization', () => {
    expect(normalizeVideoGenerationRequest({ promptMode: 'higgsfield' }).promptMode).toBe('higgsfield');
    expect(normalizeVideoGenerationRequest({ promptMode: 'invalid' as never }).promptMode).toBe('classic');
    expect(normalizeProductionPipelineRequest({ videoPromptMode: 'hybrid' }).videoPromptMode).toBe('hybrid');
  });
});

describe('Higgsfield source context', () => {
  it('loads committed Hell Grind guidance instead of ignored third_party files', () => {
    const context = buildHiggsfieldPromptContext({
      mode: 'pure',
      visualType: 'keyframe',
      hasReferences: true,
      hasDialogue: true,
    });

    expect(context.loadedPaths).toContain('AI生成指导.md');
    expect(context.loadedPaths).toContain('附件/CINEDANCE HIGGSFIELD SKILL.md');
    expect(context.loadedPaths).toContain('附件/ACTING SKILL.md');
    expect(context.loadedPaths).toContain('附件/LIRA SKILL.md');
    expect(context.content).toContain('Higgsfield source context');
    expect(context.content).toContain('examples only');
    expect(context.content).not.toContain('third_party/seedance-2.0');
  });

  it('uses a smaller context budget for hybrid enhancement', () => {
    const pure = buildHiggsfieldPromptContext({
      mode: 'pure',
      visualType: 'scene_video',
      hasReferences: true,
      hasDialogue: true,
    });
    const hybrid = buildHiggsfieldPromptContext({
      mode: 'hybrid',
      visualType: 'scene_video',
      hasReferences: true,
      hasDialogue: true,
    });

    expect(hybrid.content.length).toBeLessThan(pure.content.length);
  });
});

describe('video prompt strategy router', () => {
  it('delegates classic mode to the current Seedance compiler unchanged', () => {
    const messages = buildVideoPromptMessages({ ...baseInput, promptMode: 'classic' });
    const content = messages.map((message) => message.content).join('\n');

    expect(messages).toEqual(buildSeedancePromptMessages(baseInput));
    expect(content).not.toContain('HIGGSFIELD_PURE_MODE');
    expect(content).not.toContain('HIGGSFIELD_HYBRID_MODE');
  });

  it('builds a pure Higgsfield prompt from committed source material', () => {
    const messages = buildVideoPromptMessages({ ...baseInput, promptMode: 'higgsfield' });
    const content = messages.map((message) => message.content).join('\n');

    expect(content).toContain('HIGGSFIELD_PURE_MODE');
    expect(content).toContain('source: 附件/CINEDANCE HIGGSFIELD SKILL.md');
    expect(content).toContain('电影化英文');
    expect(content).toContain('@图片1');
    expect(content).not.toContain('/tmp/character.png');
    expect(content).not.toContain('CLASSIC_VIDEO_PROMPT_MODE');
  });

  it('enhances the classic contract with Higgsfield rules in hybrid mode', () => {
    const messages = buildVideoPromptMessages({ ...baseInput, promptMode: 'hybrid' });
    const content = messages.map((message) => message.content).join('\n');

    expect(content).toContain('Seedance 2.0 Skill OS');
    expect(content).toContain('HIGGSFIELD_HYBRID_MODE');
    expect(content).toContain('Higgsfield enhancement checklist');
    expect(content).toContain('source: 附件/ACTING SKILL.md');
  });
});
