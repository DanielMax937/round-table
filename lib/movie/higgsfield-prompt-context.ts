import fs from 'fs';
import path from 'path';

export type HiggsfieldPromptContextMode = 'pure' | 'hybrid';

export interface HiggsfieldPromptContextInput {
  mode: HiggsfieldPromptContextMode;
  visualType?: string;
  hasReferences?: boolean;
  hasDialogue?: boolean;
}

export interface HiggsfieldPromptContext {
  root: string;
  loadedPaths: string[];
  content: string;
  truncated: boolean;
}

interface SourceDocument {
  relativePath: string;
  pureBudget: number;
  hybridBudget: number;
  when?: (input: HiggsfieldPromptContextInput) => boolean;
}

const SOURCE_DOCUMENTS: SourceDocument[] = [
  {
    relativePath: 'AI生成指导.md',
    pureBudget: 11_000,
    hybridBudget: 3_500,
  },
  {
    relativePath: '附件/CINEDANCE HIGGSFIELD SKILL.md',
    pureBudget: 20_000,
    hybridBudget: 7_000,
  },
  {
    relativePath: '附件/ACTING SKILL.md',
    pureBudget: 12_000,
    hybridBudget: 4_500,
    when: (input) => input.hasDialogue || /scene|character|portrait/i.test(input.visualType || ''),
  },
  {
    relativePath: '附件/LIRA SKILL.md',
    pureBudget: 9_000,
    hybridBudget: 2_500,
    when: (input) => Boolean(input.hasReferences),
  },
];

export const HIGGSFIELD_PROMPT_SOURCE_ROOT = path.join(
  process.cwd(),
  'Hell Grind AI生成指导资料'
);

export function buildHiggsfieldPromptContext(
  input: HiggsfieldPromptContextInput
): HiggsfieldPromptContext {
  assertSourceRoot();

  const sections: string[] = [
    `# Higgsfield source context (${input.mode})`,
    'The following excerpts are committed source material. Treat their methods and output rules as authoritative for this mode.',
    'Any Hell Grind names, story facts, dialogue, or shot text inside the excerpts are examples only. Never copy them into another project.',
  ];
  const loadedPaths: string[] = [];
  let truncated = false;

  for (const document of SOURCE_DOCUMENTS) {
    if (document.when && !document.when(input)) continue;

    const absolutePath = resolveSourcePath(document.relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`Higgsfield source file not found: ${document.relativePath}`);
    }

    const source = fs.readFileSync(absolutePath, 'utf8').trim();
    const budget = input.mode === 'pure' ? document.pureBudget : document.hybridBudget;
    const excerpt = clipAtBoundary(source, budget);
    loadedPaths.push(document.relativePath);
    truncated = truncated || excerpt.length < source.length;
    sections.push(
      '',
      `## source: ${document.relativePath}`,
      excerpt,
      excerpt.length < source.length ? '[source excerpt truncated to prompt budget]' : ''
    );
  }

  return {
    root: HIGGSFIELD_PROMPT_SOURCE_ROOT,
    loadedPaths,
    content: sections.filter(Boolean).join('\n'),
    truncated,
  };
}

function assertSourceRoot(): void {
  if (!fs.existsSync(HIGGSFIELD_PROMPT_SOURCE_ROOT) || !fs.statSync(HIGGSFIELD_PROMPT_SOURCE_ROOT).isDirectory()) {
    throw new Error(`Higgsfield prompt source root not found: ${HIGGSFIELD_PROMPT_SOURCE_ROOT}`);
  }
}

function resolveSourcePath(relativePath: string): string {
  const absolutePath = path.resolve(HIGGSFIELD_PROMPT_SOURCE_ROOT, relativePath);
  const relative = path.relative(HIGGSFIELD_PROMPT_SOURCE_ROOT, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Higgsfield source path escapes source root: ${relativePath}`);
  }
  return absolutePath;
}

function clipAtBoundary(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const candidate = value.slice(0, maxChars);
  const boundary = Math.max(candidate.lastIndexOf('\n## '), candidate.lastIndexOf('\n\n'));
  return candidate.slice(0, boundary >= maxChars * 0.65 ? boundary : maxChars).trimEnd();
}
