import {
  buildSeedanceSkillOsContext,
  getSeedanceSkillOsManifest,
  readSeedanceSkillOsFile,
  selectSeedanceSkillOsContextPaths,
} from '../seedance-skill-os';

describe('seedance skill os loader', () => {
  it('loads the vendored upstream Skill OS manifest', () => {
    const manifest = getSeedanceSkillOsManifest();

    expect(manifest.version).toBe('6.6.0');
    expect(manifest.fileCount).toBeGreaterThanOrEqual(200);
    expect(manifest.skillCount).toBe(28);
    expect(manifest.scriptCount).toBeGreaterThanOrEqual(15);
  });

  it('blocks reads outside the vendored root', () => {
    expect(() => readSeedanceSkillOsFile('../package.json')).toThrow(/escapes vendor root/);
  });

  it('selects reference workflow files for image and reference-to-video prompts', () => {
    const paths = selectSeedanceSkillOsContextPaths({
      mode: 'R2V',
      sequenceRelation: 'standalone_clip',
      shotStructure: 'compact_single_take',
      hasReferences: true,
    });

    expect(paths).toContain('references/reference-workflow.md');
    expect(paths).toContain('references/i2v-guide.md');
    expect(paths).toContain('references/reference-transfer-contract.md');
  });

  it('selects sequence and storyboard rules only when the request needs them', () => {
    const paths = selectSeedanceSkillOsContextPaths({
      mode: 'I2V',
      sequenceRelation: 'sequence_first_clip',
      shotStructure: 'dense_multishot',
      visualType: 'storyboard',
      hasReferences: true,
    });

    expect(paths).toContain('skills/seedance-sequence/SKILL.md');
    expect(paths).toContain('references/prompt-compiler.md');
    expect(paths).toContain('references/dense-storyboard-mode.md');
    expect(paths).toContain('references/multishot-grammar.md');
  });

  it('builds LLM context from real upstream documents', () => {
    const context = buildSeedanceSkillOsContext({
      mode: 'I2V',
      sequenceRelation: 'standalone_clip',
      shotStructure: 'compact_single_take',
      hasReferences: true,
      maxChars: 52000,
    });

    expect(context.content).toContain('source: SKILL.md');
    expect(context.content).toContain('source: skills/seedance-prompt/SKILL.md');
    expect(context.content).toContain('source: references/reference-workflow.md');
    expect(context.content).toContain('Prompt only what the image cannot show');
  });
});
