# Blog Post Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add feature to generate Substack-ready blog posts from round table discussions using Claude synthesis

**Architecture:** New API route at `/api/roundtable/[id]/blog-post` that fetches all discussion messages, sends them to Claude for synthesis into a cohesive narrative article, and streams the markdown response via SSE. Frontend modal component displays streaming generation with copy/download capabilities.

**Tech Stack:** Next.js API Routes, Anthropic Claude API (direct, not Agent SDK), SSE streaming, React Client Component

---

## Task 1: Create Blog Synthesis Library

**Files:**
- Create: `lib/blog/synthesizer.ts`
- Create: `lib/blog/types.ts`

**Step 1: Write types for blog synthesis**

Create `lib/blog/types.ts`:

```typescript
// Blog post synthesis types

export interface SynthesisEvent {
  type: 'synthesis-start' | 'chunk' | 'synthesis-complete' | 'error';
  data: {
    chunk?: string;
    fullContent?: string;
    error?: string;
    timestamp: Date;
  };
}

export interface SynthesisInput {
  topic: string;
  messages: Array<{
    agentName: string;
    content: string;
    roundNumber: number;
  }>;
}
```

**Step 2: Write test for blog synthesizer**

Create test file `scripts/test-blog-synthesis.ts`:

```typescript
import { synthesizeBlogPost } from '../lib/blog/synthesizer';

async function testSynthesis() {
  const input = {
    topic: "The Future of AI",
    messages: [
      {
        agentName: "Devil's Advocate",
        content: "AI poses significant risks...",
        roundNumber: 1
      },
      {
        agentName: "The Optimist",
        content: "AI will revolutionize healthcare...",
        roundNumber: 1
      }
    ]
  };

  console.log('Starting synthesis...\n');

  for await (const event of synthesizeBlogPost(input, process.env.ANTHROPIC_API_KEY!)) {
    if (event.type === 'chunk') {
      process.stdout.write(event.data.chunk || '');
    } else {
      console.log(`\n[${event.type}]`, event.data);
    }
  }
}

testSynthesis().catch(console.error);
```

**Step 3: Run test to verify it fails**

Run: `tsx scripts/test-blog-synthesis.ts`

Expected: Error "Cannot find module '../lib/blog/synthesizer'"

**Step 4: Implement blog synthesizer**

Create `lib/blog/synthesizer.ts`:

```typescript
// Blog post synthesis using Claude API

import Anthropic from '@anthropic-ai/sdk';
import { SynthesisEvent, SynthesisInput } from './types';

/**
 * Build synthesis prompt from discussion messages
 */
function buildSynthesisPrompt(input: SynthesisInput): string {
  // Group messages by round
  const roundGroups = new Map<number, Array<{ agentName: string; content: string }>>();

  for (const msg of input.messages) {
    if (!roundGroups.has(msg.roundNumber)) {
      roundGroups.set(msg.roundNumber, []);
    }
    roundGroups.get(msg.roundNumber)!.push({
      agentName: msg.agentName,
      content: msg.content
    });
  }

  // Build prompt
  let prompt = `You are synthesizing a blog post from a multi-agent AI discussion on the topic: "${input.topic}"\n\n`;
  prompt += `The following agents discussed this topic across ${roundGroups.size} round(s):\n\n`;

  // Add discussion content
  for (const [roundNum, messages] of Array.from(roundGroups.entries()).sort(([a], [b]) => a - b)) {
    prompt += `## Round ${roundNum}\n\n`;
    for (const msg of messages) {
      prompt += `**${msg.agentName}:**\n${msg.content}\n\n`;
    }
  }

  prompt += `\n---\n\n`;
  prompt += `Please synthesize this discussion into a compelling blog post suitable for Substack:\n\n`;
  prompt += `1. Write an engaging introduction that frames the topic\n`;
  prompt += `2. Organize the key themes and perspectives into clear sections\n`;
  prompt += `3. Integrate insights from different agents into a cohesive narrative\n`;
  prompt += `4. Write a conclusion that synthesizes the main takeaways\n`;
  prompt += `5. Use an engaging, accessible writing style (not academic)\n`;
  prompt += `6. Target length: 1000-1500 words\n`;
  prompt += `7. Format in clean markdown with proper headers and structure\n\n`;
  prompt += `Do not mention that this came from AI agents - write as if you're a single author synthesizing these perspectives.`;

  return prompt;
}

/**
 * Synthesize blog post from discussion with streaming
 */
export async function* synthesizeBlogPost(
  input: SynthesisInput,
  apiKey: string
): AsyncGenerator<SynthesisEvent> {
  const anthropic = new Anthropic({
    apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });

  yield {
    type: 'synthesis-start',
    data: { timestamp: new Date() }
  };

  try {
    const prompt = buildSynthesisPrompt(input);

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: true,
    });

    let fullContent = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          const chunk = event.delta.text;
          fullContent += chunk;

          yield {
            type: 'chunk',
            data: {
              chunk,
              timestamp: new Date()
            }
          };
        }
      }
    }

    yield {
      type: 'synthesis-complete',
      data: {
        fullContent,
        timestamp: new Date()
      }
    };

  } catch (error) {
    yield {
      type: 'error',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    };
  }
}
```

**Step 5: Run test to verify it passes**

Run: `tsx scripts/test-blog-synthesis.ts`

Expected: Streams blog post generation, shows synthesis-start → chunks → synthesis-complete

**Step 6: Commit**

```bash
git add lib/blog/
git commit -m "feat: add blog post synthesis library

- Create blog synthesis types
- Implement synthesizeBlogPost with streaming
- Add test script for synthesis"
```

---

## Task 2: Create Blog Post API Route

**Files:**
- Create: `app/api/roundtable/[id]/blog-post/route.ts`

**Step 1: Write test for API route**

Update `scripts/test-api.ts` to add blog post test:

```typescript
// Add to existing test-api.ts

async function testBlogPostGeneration() {
  console.log('\n=== Testing Blog Post Generation ===\n');

  // Assuming roundTableId from previous tests
  const roundTableId = 'your-test-id';

  const response = await fetch(`http://localhost:3000/api/roundtable/${roundTableId}/blog-post`, {
    method: 'POST',
  });

  if (!response.ok) {
    console.error('Failed:', response.status, response.statusText);
    return;
  }

  console.log('Streaming blog post...\n');

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    console.error('No reader available');
    return;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('event:')) {
        const event = line.slice(7);
        console.log(`\n[Event: ${event}]`);
      } else if (line.startsWith('data:')) {
        const data = JSON.parse(line.slice(6));
        if (data.chunk) {
          process.stdout.write(data.chunk);
        } else {
          console.log(data);
        }
      }
    }
  }
}

// Call in main test flow
testBlogPostGeneration().catch(console.error);
```

**Step 2: Run test to verify it fails**

Run: `npm run dev` (in separate terminal)
Run: `npm run test:api`

Expected: 404 error - route not found

**Step 3: Implement API route**

Create `app/api/roundtable/[id]/blog-post/route.ts`:

```typescript
// POST /api/roundtable/[id]/blog-post - Generate blog post from discussion

import { NextRequest, NextResponse } from 'next/server';
import { getRoundTable } from '@/lib/db/roundtable';
import { getAllMessagesForRoundTable } from '@/lib/db/messages';
import { getAgentsByRoundTable } from '@/lib/db/agents';
import { synthesizeBlogPost } from '@/lib/blog/synthesizer';
import type { SynthesisEvent } from '@/lib/blog/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    // Get API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    // Verify round table exists
    const roundTable = await getRoundTable(id);
    if (!roundTable) {
      return NextResponse.json(
        { error: 'Round table not found' },
        { status: 404 }
      );
    }

    // Get all messages
    const messages = await getAllMessagesForRoundTable(id);
    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'No discussion messages found. Start at least one round first.' },
        { status: 400 }
      );
    }

    // Get agents for name mapping
    const agents = await getAgentsByRoundTable(id);
    const agentMap = new Map(agents.map(a => [a.id, a.name]));

    // Format messages for synthesis
    const synthesisInput = {
      topic: roundTable.topic,
      messages: messages.map(msg => ({
        agentName: agentMap.get(msg.agentId) || 'Unknown',
        content: msg.content,
        roundNumber: msg.round.roundNumber
      }))
    };

    // Set up SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        try {
          for await (const event of synthesizeBlogPost(synthesisInput, apiKey)) {
            sendEvent(event.type, event.data);
          }

          sendEvent('done', { timestamp: new Date() });
          controller.close();
        } catch (error) {
          console.error('Error generating blog post:', error);
          sendEvent('error', {
            error: 'Blog post generation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    });

  } catch (error) {
    console.error('Error in blog post API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate blog post',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:api`

Expected: SSE stream with synthesis-start → chunk events → synthesis-complete → done

**Step 5: Commit**

```bash
git add app/api/roundtable/[id]/blog-post/
git commit -m "feat: add blog post generation API route

- POST /api/roundtable/[id]/blog-post endpoint
- SSE streaming of synthesized blog post
- Validation for round table and messages"
```

---

## Task 3: Create Blog Post Modal Component

**Files:**
- Create: `components/BlogPostModal.tsx`

**Step 1: Write component structure**

Create `components/BlogPostModal.tsx`:

```typescript
'use client';

import { useState } from 'react';

interface BlogPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  roundTableId: string;
  topic: string;
}

export function BlogPostModal({ isOpen, onClose, roundTableId, topic }: BlogPostModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [blogPost, setBlogPost] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateBlogPost = async () => {
    setIsGenerating(true);
    setError(null);
    setBlogPost('');

    try {
      const response = await fetch(`/api/roundtable/${roundTableId}/blog-post`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate blog post');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // Event type line
            continue;
          } else if (line.startsWith('data:')) {
            const data = JSON.parse(line.slice(6));

            if (data.chunk) {
              setBlogPost(prev => prev + data.chunk);
            } else if (data.error) {
              setError(data.error);
            }
          }
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([blogPost], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic.toLowerCase().replace(/\s+/g, '-')}-blog-post.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(blogPost);
    // Could add toast notification here
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Generate Blog Post</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isGenerating && !blogPost && !error && (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-6">
                Generate a Substack-ready blog post from this round table discussion on:
              </p>
              <p className="text-xl font-semibold text-gray-900 mb-8">"{topic}"</p>
              <button
                onClick={generateBlogPost}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Generate Blog Post
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-blue-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span>Synthesizing discussion into blog post...</span>
              </div>
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-4 rounded">
                  {blogPost}
                </pre>
              </div>
            </div>
          )}

          {!isGenerating && blogPost && (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-4 rounded">
                {blogPost}
              </pre>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
              Error: {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {blogPost && !isGenerating && (
          <div className="p-6 border-t flex gap-3 justify-end">
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={downloadMarkdown}
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Download Markdown
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit component**

```bash
git add components/BlogPostModal.tsx
git commit -m "feat: add blog post modal component

- Client component for blog post generation
- SSE streaming display
- Copy to clipboard and download functionality"
```

---

## Task 4: Integrate Modal into Round Table Page

**Files:**
- Modify: `app/roundtable/[id]/page.tsx`

**Step 1: Read existing page**

Run: `cat app/roundtable/[id]/page.tsx` to understand current structure

**Step 2: Add blog post button and modal**

Modify the round table detail page to:
1. Import BlogPostModal
2. Add state for modal visibility
3. Add "Generate Blog Post" button
4. Render modal component

Example integration:

```typescript
// Add to imports
import { BlogPostModal } from '@/components/BlogPostModal';
import { useState } from 'react';

// In component (make it 'use client' if not already)
const [showBlogModal, setShowBlogModal] = useState(false);

// Add button near "Continue to Round X" button
<button
  onClick={() => setShowBlogModal(true)}
  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
>
  Generate Blog Post
</button>

// Add modal at end of component
<BlogPostModal
  isOpen={showBlogModal}
  onClose={() => setShowBlogModal(false)}
  roundTableId={roundTable.id}
  topic={roundTable.topic}
/>
```

**Step 3: Test in browser**

Run: `npm run dev`

1. Navigate to a round table with completed rounds
2. Click "Generate Blog Post" button
3. Verify modal opens
4. Click "Generate Blog Post" in modal
5. Watch streaming generation
6. Test copy and download buttons

Expected: Smooth streaming, functional copy/download

**Step 4: Commit**

```bash
git add app/roundtable/[id]/page.tsx
git commit -m "feat: integrate blog post generation into round table page

- Add Generate Blog Post button
- Integrate BlogPostModal component"
```

---

## Task 5: Add Test Script and Documentation

**Files:**
- Modify: `package.json`
- Create: `docs/BLOG_POST_FEATURE.md`

**Step 1: Add test script**

Update `package.json`:

```json
{
  "scripts": {
    "test:blog": "tsx scripts/test-blog-synthesis.ts"
  }
}
```

**Step 2: Create feature documentation**

Create `docs/BLOG_POST_FEATURE.md`:

```markdown
# Blog Post Generation Feature

## Overview

Convert round table discussions into polished Substack-ready blog posts using Claude synthesis.

## How It Works

1. User completes one or more discussion rounds
2. Click "Generate Blog Post" on round table detail page
3. Modal opens with streaming generation
4. Download markdown or copy to clipboard
5. Paste into Substack editor

## Technical Implementation

### API Route
- **Endpoint**: `POST /api/roundtable/[id]/blog-post`
- **Response**: SSE stream
- **Events**: synthesis-start, chunk, synthesis-complete, error, done

### Synthesis Process
1. Fetch all messages from all rounds
2. Build synthesis prompt with full discussion context
3. Instruct Claude to organize into thematic sections
4. Stream markdown response to client
5. No database persistence (ephemeral generation)

### Components
- `BlogPostModal.tsx`: Client component with streaming UI
- `lib/blog/synthesizer.ts`: Core synthesis logic
- `lib/blog/types.ts`: TypeScript types

## Usage Examples

```typescript
// Generate blog post programmatically
import { synthesizeBlogPost } from '@/lib/blog/synthesizer';

const input = {
  topic: "AI Safety",
  messages: [/* discussion messages */]
};

for await (const event of synthesizeBlogPost(input, apiKey)) {
  if (event.type === 'chunk') {
    console.log(event.data.chunk);
  }
}
```

## Testing

```bash
# Test synthesis directly
npm run test:blog

# Test API integration
npm run test:api
```

## Markdown Output Format

Generated posts include:
- Engaging introduction
- Thematic body sections (2-4 sections)
- Synthesized conclusion
- Proper markdown headers (H2, H3)
- 1000-1500 word target length

## Future Enhancements

- Custom synthesis instructions (tone, length, format)
- Multiple output formats (Twitter thread, LinkedIn post)
- Save favorite posts to database
- Substack API direct publishing
```

**Step 3: Update main CLAUDE.md**

Add to `CLAUDE.md` under "Key Implementation Patterns":

```markdown
### Generating Blog Posts

1. User clicks "Generate Blog Post" on round table page
2. `POST /api/roundtable/[id]/blog-post` fetches all messages
3. Messages sent to Claude for synthesis via `synthesizeBlogPost()`
4. SSE stream returns markdown blog post
5. User downloads or copies to clipboard for Substack

Blog posts are ephemeral - generated on-demand, not persisted.
```

**Step 4: Commit documentation**

```bash
git add package.json docs/BLOG_POST_FEATURE.md CLAUDE.md
git commit -m "docs: add blog post feature documentation

- Add test:blog script
- Create feature documentation
- Update CLAUDE.md with blog post pattern"
```

---

## Completion Checklist

- [ ] Blog synthesis library created and tested
- [ ] API route implemented with SSE streaming
- [ ] Modal component built with streaming UI
- [ ] Integration into round table page complete
- [ ] All tests passing (test:blog, test:api)
- [ ] Documentation complete
- [ ] Feature tested end-to-end in browser

## Notes

- No database migrations needed
- No new dependencies required
- Follows existing SSE streaming patterns
- Reuses Claude API setup from agent execution
- Feature is additive - doesn't modify existing functionality
