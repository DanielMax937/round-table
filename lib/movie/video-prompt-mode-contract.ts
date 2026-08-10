export const VIDEO_PROMPT_MODE_OPTIONS = [
  {
    value: 'classic',
    label: '经典模式',
    shortLabel: '经典',
    description: '原样使用当前 Seedance Skill OS 提示词流程，兼容已有任务和调用。',
  },
  {
    value: 'higgsfield',
    label: '纯 Higgsfield',
    shortLabel: 'Higgsfield',
    description: '只依据 Hell Grind、CINEDANCE、ACTING 与 LIRA 资料导演当前镜头。',
  },
  {
    value: 'hybrid',
    label: 'Higgsfield 增强',
    shortLabel: '增强',
    description: '保留经典流程骨架，并用 Higgsfield 规则增强表演、连续性与镜头约束。',
  },
] as const;

export type VideoPromptMode = (typeof VIDEO_PROMPT_MODE_OPTIONS)[number]['value'];

const VIDEO_PROMPT_MODE_VALUES = new Set<string>(
  VIDEO_PROMPT_MODE_OPTIONS.map((option) => option.value)
);

export function normalizeVideoPromptMode(value: unknown): VideoPromptMode {
  return typeof value === 'string' && VIDEO_PROMPT_MODE_VALUES.has(value)
    ? value as VideoPromptMode
    : 'classic';
}

export function getVideoPromptModeLabel(value: unknown): string {
  const mode = normalizeVideoPromptMode(value);
  return VIDEO_PROMPT_MODE_OPTIONS.find((option) => option.value === mode)?.label || '经典模式';
}
