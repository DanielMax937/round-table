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
