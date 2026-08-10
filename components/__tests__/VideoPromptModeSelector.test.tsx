import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import VideoPromptModeSelector from '../VideoPromptModeSelector';

describe('VideoPromptModeSelector', () => {
  it('renders all three prompt modes and exposes the selected value', () => {
    const html = renderToStaticMarkup(
      <VideoPromptModeSelector value="higgsfield" onChange={() => undefined} />
    );

    expect(html.match(/data-video-prompt-mode=/g)).toHaveLength(3);
    expect(html).toContain('data-video-prompt-mode="classic"');
    expect(html).toContain('data-video-prompt-mode="higgsfield"');
    expect(html).toContain('data-video-prompt-mode="hybrid"');
    expect(html).toContain('aria-checked="true"');
  });
});
