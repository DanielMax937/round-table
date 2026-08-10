'use client';

import React from 'react';
import {
  VIDEO_PROMPT_MODE_OPTIONS,
  type VideoPromptMode,
} from '@/lib/movie/video-prompt-mode-contract';

interface VideoPromptModeSelectorProps {
  value: VideoPromptMode;
  onChange: (mode: VideoPromptMode) => void;
  disabled?: boolean;
  variant?: 'workflow' | 'studio';
}

export default function VideoPromptModeSelector({
  value,
  onChange,
  disabled = false,
  variant = 'workflow',
}: VideoPromptModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="视频提示词生成模式"
      className={variant === 'studio' ? 'grid gap-2' : 'grid gap-2 md:grid-cols-3'}
    >
      {VIDEO_PROMPT_MODE_OPTIONS.map((option) => {
        const selected = value === option.value;
        const className = variant === 'studio'
          ? selected
            ? 'border-yellow-300 bg-yellow-300 text-neutral-950'
            : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:bg-neutral-800'
          : selected
            ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100'
            : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200';

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-video-prompt-mode={option.value}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className={`mt-1 block text-xs leading-5 ${selected && variant === 'studio' ? 'text-neutral-800' : 'opacity-70'}`}>
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
