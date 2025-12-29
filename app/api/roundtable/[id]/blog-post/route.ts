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
