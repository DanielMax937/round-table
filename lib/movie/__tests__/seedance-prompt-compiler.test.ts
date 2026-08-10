import {
  buildSeedancePromptMessages,
  buildSeedancePromptPlan,
} from '../seedance-prompt-compiler';

describe('seedance prompt compiler', () => {
  it('classifies text-only requests as T2V', () => {
    const plan = buildSeedancePromptPlan({
      movieTitle: 'Test Movie',
      visualTitle: 'Scene 1',
      visualType: 'scene_video',
      requestedDurationSeconds: 8,
    });

    expect(plan.mode).toBe('T2V');
    expect(plan.sequenceRelation).toBe('standalone_clip');
    expect(plan.referenceRoles).toEqual([]);
  });

  it('assigns a first-frame anchor for single image-to-video prompts', () => {
    const plan = buildSeedancePromptPlan({
      movieTitle: 'Test Movie',
      visualTitle: 'Keyframe',
      visualType: 'keyframe',
      requestedDurationSeconds: 8,
      sourceImagePaths: ['/tmp/keyframe.png'],
    });

    expect(plan.mode).toBe('I2V');
    expect(plan.referenceRoles).toHaveLength(1);
    expect(plan.referenceRoles[0]).toMatchObject({
      tag: '@图片1',
      role: 'first-frame subject identity anchor',
    });
  });

  it('assigns role boundaries for multi-reference prompts', () => {
    const plan = buildSeedancePromptPlan({
      movieTitle: 'Test Movie',
      visualTitle: 'Storyboard',
      visualType: 'storyboard',
      requestedDurationSeconds: 10,
      sourceImagePaths: ['/tmp/panel-1.png', '/tmp/panel-2.png'],
    });

    expect(plan.mode).toBe('R2V');
    expect(plan.shotStructure).toBe('dense_multishot');
    expect(plan.referenceRoles.map((role) => role.tag)).toEqual(['@图片1', '@图片2']);
    expect(plan.referenceRoles[1].role).toBe('shot-order and blocking reference');
  });

  it('compiles long requests as the first local clip only', () => {
    const plan = buildSeedancePromptPlan({
      movieTitle: 'Test Movie',
      visualTitle: 'Long scene',
      visualType: 'scene_video',
      requestedDurationSeconds: 30,
    });

    expect(plan.sequenceRelation).toBe('sequence_first_clip');
    expect(plan.promptDurationSeconds).toBe(15);
  });

  it('passes the requested ratio into the LLM prompt instead of hard-coding 16:9', () => {
    const messages = buildSeedancePromptMessages({
      movieTitle: 'Vertical Story',
      visualTitle: 'Scene 1',
      visualType: 'scene_video',
      requestedDurationSeconds: 8,
      ratio: '9:16',
    });

    expect(messages[1].content).toContain('Ratio: 9:16');
    expect(messages[1].content).not.toContain('画面比例：16:9');
  });

  it('loads vendored Seedance Skill OS rules into the LLM system message', () => {
    const messages = buildSeedancePromptMessages({
      movieTitle: 'Reference Story',
      visualTitle: 'Keyframe',
      visualType: 'keyframe',
      requestedDurationSeconds: 8,
      sourceImagePaths: ['/tmp/keyframe.png'],
    });

    expect(messages[0].content).toContain('Vendored Seedance 2.0 Skill OS Runtime Context');
    expect(messages[0].content).toContain('source: skills/seedance-prompt/SKILL.md');
    expect(messages[0].content).toContain('source: references/i2v-guide.md');
    expect(messages[0].content).toContain('Prompt only what the image cannot show');
  });
});
