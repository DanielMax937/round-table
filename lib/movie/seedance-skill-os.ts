import fs from 'fs';
import path from 'path';

export type SeedanceSkillOsMode = 'T2V' | 'I2V' | 'R2V';
export type SeedanceSkillOsSequenceRelation = 'standalone_clip' | 'sequence_first_clip';
export type SeedanceSkillOsShotStructure = 'compact_single_take' | 'phased_single_take' | 'dense_multishot';

export interface SeedanceSkillOsContextInput {
  mode: SeedanceSkillOsMode;
  sequenceRelation: SeedanceSkillOsSequenceRelation;
  shotStructure: SeedanceSkillOsShotStructure;
  visualType?: string;
  hasReferences?: boolean;
  maxChars?: number;
}

export interface SeedanceSkillOsDocument {
  path: string;
  content: string;
  truncated: boolean;
}

export interface SeedanceSkillOsContext {
  root: string;
  version: string;
  loadedPaths: string[];
  documents: SeedanceSkillOsDocument[];
  content: string;
  truncated: boolean;
}

export interface SeedanceSkillOsManifest {
  root: string;
  version: string;
  fileCount: number;
  skillCount: number;
  scriptCount: number;
}

export const SEEDANCE_SKILL_OS_ROOT = path.join(process.cwd(), 'third_party', 'seedance-2.0');

const DEFAULT_CONTEXT_MAX_CHARS = 52000;

const CORE_CONTEXT_PATHS = [
  'SKILL.md',
  'skills/seedance-prompt/SKILL.md',
  'references/quick-ref.md',
  'references/prompt-compiler.md',
  'references/reference-workflow.md',
] as const;

const REFERENCE_CONTEXT_PATHS = [
  'references/i2v-guide.md',
  'references/reference-transfer-contract.md',
] as const;

const SEQUENCE_CONTEXT_PATHS = [
  'skills/seedance-sequence/SKILL.md',
  'skills/seedance-continuation/SKILL.md',
  'references/sequence-project-state.md',
  'references/continuation-handoff.md',
  'references/event-density.md',
  'references/continuity-qc.md',
] as const;

const STORYBOARD_CONTEXT_PATHS = [
  'references/dense-storyboard-mode.md',
  'references/multishot-grammar.md',
  'references/2d-anime-grammar.md',
] as const;

const SUPPORT_CONTEXT_PATHS = [
  'skills/seedance-prompt-short/SKILL.md',
  'references/surface-prompt-profiles.md',
  'references/capability-map.md',
  'references/allocation-model.md',
  'references/directing-engine.md',
  'references/anti-slop-lexicon.md',
  'references/filter-vocab.md',
  'references/vocab/zh.md',
] as const;

let manifestCache: SeedanceSkillOsManifest | null = null;

export function getSeedanceSkillOsManifest(): SeedanceSkillOsManifest {
  if (manifestCache) return manifestCache;
  assertSkillOsRoot();

  const files = listSeedanceSkillOsFiles();
  const rootSkill = readSeedanceSkillOsFile('SKILL.md');
  const version = rootSkill.match(/version:\s*["']?([^"'\n]+)["']?/)?.[1] || 'unknown';

  manifestCache = {
    root: SEEDANCE_SKILL_OS_ROOT,
    version,
    fileCount: files.length,
    skillCount: files.filter((file) => file.startsWith('skills/') && file.endsWith('/SKILL.md')).length,
    scriptCount: files.filter((file) => file.startsWith('scripts/') && file.endsWith('.py')).length,
  };

  return manifestCache;
}

export function listSeedanceSkillOsFiles(): string[] {
  assertSkillOsRoot();

  const files: string[] = [];
  walk(SEEDANCE_SKILL_OS_ROOT, files);
  return files.sort();
}

export function readSeedanceSkillOsFile(relativePath: string): string {
  const absolutePath = resolveSkillOsPath(relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Seedance Skill OS file not found: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

export function selectSeedanceSkillOsContextPaths(input: SeedanceSkillOsContextInput): string[] {
  const paths: string[] = [...CORE_CONTEXT_PATHS];

  if (input.hasReferences || input.mode === 'I2V' || input.mode === 'R2V') {
    paths.push(...REFERENCE_CONTEXT_PATHS);
  }

  if (input.sequenceRelation === 'sequence_first_clip') {
    paths.push(...SEQUENCE_CONTEXT_PATHS);
  }

  if (input.shotStructure === 'dense_multishot' || input.visualType === 'storyboard' || input.visualType === 'comic') {
    paths.push(...STORYBOARD_CONTEXT_PATHS);
  }

  paths.push(...SUPPORT_CONTEXT_PATHS);

  return Array.from(new Set(paths));
}

export function buildSeedanceSkillOsContext(input: SeedanceSkillOsContextInput): SeedanceSkillOsContext {
  const manifest = getSeedanceSkillOsManifest();
  const selectedPaths = selectSeedanceSkillOsContextPaths(input);
  const maxChars = Math.max(8000, input.maxChars || DEFAULT_CONTEXT_MAX_CHARS);
  const header = [
    '# Vendored Seedance 2.0 Skill OS Runtime Context',
    `root: ${manifest.root}`,
    `version: ${manifest.version}`,
    `vendored_file_count: ${manifest.fileCount}`,
    `vendored_skill_count: ${manifest.skillCount}`,
    `vendored_script_count: ${manifest.scriptCount}`,
    'The following sections are loaded from the vendored upstream repository. Use them as the rule source for this compile.',
  ].join('\n');

  const documents: SeedanceSkillOsDocument[] = [];
  let remaining = maxChars - header.length - 2;
  let truncated = remaining < 0;

  for (const relativePath of selectedPaths) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }

    const text = readSeedanceSkillOsFile(relativePath).trim();
    const sectionPrefix = `\n\n---\nsource: ${relativePath}\n---\n`;
    const available = remaining - sectionPrefix.length;
    if (available <= 0) {
      truncated = true;
      break;
    }

    const content = text.length > available
      ? `${text.slice(0, Math.max(0, available - 72)).trimEnd()}\n\n[truncated by local context budget]`
      : text;
    const documentTruncated = content.length < text.length;

    documents.push({
      path: relativePath,
      content,
      truncated: documentTruncated,
    });

    remaining -= sectionPrefix.length + content.length;
    truncated = truncated || documentTruncated;
  }

  const content = [
    header,
    ...documents.map((document) => [
      '',
      '---',
      `source: ${document.path}`,
      '---',
      document.content,
    ].join('\n')),
    truncated ? '\n[Some selected Seedance Skill OS context was truncated by the local prompt budget.]' : '',
  ].filter(Boolean).join('\n');

  return {
    root: manifest.root,
    version: manifest.version,
    loadedPaths: documents.map((document) => document.path),
    documents,
    content,
    truncated,
  };
}

function assertSkillOsRoot(): void {
  if (!fs.existsSync(SEEDANCE_SKILL_OS_ROOT) || !fs.statSync(SEEDANCE_SKILL_OS_ROOT).isDirectory()) {
    throw new Error(`Seedance Skill OS root not found: ${SEEDANCE_SKILL_OS_ROOT}`);
  }
}

function resolveSkillOsPath(relativePath: string): string {
  const root = path.resolve(SEEDANCE_SKILL_OS_ROOT);
  const absolutePath = path.resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Seedance Skill OS path escapes vendor root: ${relativePath}`);
  }
  return absolutePath;
}

function walk(directory: string, files: string[]): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    files.push(path.relative(SEEDANCE_SKILL_OS_ROOT, absolutePath).split(path.sep).join('/'));
  }
}
