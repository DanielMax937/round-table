// POST /api/roundtable/[id]/round - Start a new round with SSE streaming

import { NextRequest, NextResponse } from 'next/server';
import { getRoundTableWithDetails, canStartNewRound } from '@/lib/db/roundtable';
import { getAgentsByRoundTable } from '@/lib/db/agents';
import {
  createRound,
  getNextRoundNumber,
  updateRoundStatus,
  completeRound,
} from '@/lib/db/rounds';
import { createMessage, getMessagesByRound } from '@/lib/db/messages';
import { executeRound, validateRoundExecution } from '@/lib/agents/orchestrator';
import { getAllMessagesForRoundTable } from '@/lib/db/messages';
import type { OrchestratorEvent } from '@/lib/agents/orchestrator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    // Get API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    // Get round table with details
    const roundTable = await getRoundTableWithDetails(id);
    if (!roundTable) {
      return NextResponse.json({ error: 'Round table not found' }, { status: 404 });
    }

    // Check if round table is active
    if (roundTable.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot start round: round table is ${roundTable.status}` },
        { status: 400 }
      );
    }

    // Get agents
    const agents = await getAgentsByRoundTable(id);
    if (agents.length === 0) {
      return NextResponse.json({ error: 'No agents found for this round table' }, { status: 400 });
    }

    // Validate round execution
    const validation = validateRoundExecution(agents, roundTable.topic, apiKey);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check if max rounds limit reached
    const canStart = await canStartNewRound(id);
    if (!canStart) {
      const roundNumber = await getNextRoundNumber(id);
      return NextResponse.json(
        { error: `Maximum rounds reached (${roundTable.maxRounds} of ${roundTable.maxRounds})` },
        { status: 400 }
      );
    }

    // Create new round
    const roundNumber = await getNextRoundNumber(id);
    const round = await createRound(id, roundNumber);

    // Get all previous messages for context
    const previousMessages = (await getAllMessagesForRoundTable(id)).map((msg) => ({
      ...msg,
      agent: agents.find((a) => a.id === msg.agentId)!,
    }));

    // Set up Server-Sent Events stream
    const encoder = new TextEncoder();
    let isControllerClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          if (isControllerClosed) return;
          try {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (error) {
            // Controller may have been closed by client disconnect
            console.error('Error sending SSE event:', error);
            isControllerClosed = true;
          }
        };

        try {
          // Send round start event
          sendEvent('round-start', {
            roundId: round.id,
            roundNumber: round.roundNumber,
            agentCount: agents.length,
          });

          // Execute round with agents
          let messageBuffer = '';
          let currentToolCalls: any[] = [];
          let currentCitations: any[] = [];
          const completedMessages: Array<{ agentId: string; content: string; toolCalls: any[]; citations: any[] }> = [];

          const roundResult = await executeRound(
            agents,
            roundTable.topic,
            roundNumber,
            previousMessages,
            {
              apiKey,
              onEvent: (event: OrchestratorEvent) => {
                switch (event.type) {
                  case 'agent-start':
                    sendEvent('agent-start', {
                      agentId: event.data.agentId,
                      agentName: event.data.agentName,
                      timestamp: event.data.timestamp,
                    });
                    messageBuffer = '';
                    currentToolCalls = [];
                    currentCitations = [];
                    break;

                  case 'chunk':
                    // Stream chunks to client
                    sendEvent('chunk', {
                      agentId: event.data.agentId,
                      agentName: event.data.agentName,
                      chunk: event.data.chunk,
                      timestamp: event.data.timestamp,
                    });
                    messageBuffer += event.data.chunk;
                    break;

                  case 'tool-call':
                    // Notify about tool call
                    sendEvent('tool-call', {
                      agentId: event.data.agentId,
                      agentName: event.data.agentName,
                      toolCall: event.data.toolCall,
                      timestamp: event.data.timestamp,
                    });
                    currentToolCalls.push(event.data.toolCall);
                    break;

                  case 'agent-complete':
                    // Store completed message data
                    completedMessages.push({
                      agentId: event.data.agentId!,
                      content: messageBuffer,
                      toolCalls: [...currentToolCalls],
                      citations: [...currentCitations],
                    });

                    sendEvent('agent-complete', {
                      agentId: event.data.agentId,
                      agentName: event.data.agentName,
                      timestamp: event.data.timestamp,
                    });
                    break;

                  case 'round-complete':
                    // Round complete - update status
                    completeRound(round.id)
                      .then(() => {
                        sendEvent('round-complete', {
                          roundId: round.id,
                          roundNumber: round.roundNumber,
                          timestamp: new Date(),
                        });
                      })
                      .catch((error) => {
                        console.error('Error completing round:', error);
                        sendEvent('error', {
                          error: 'Failed to complete round',
                          details: error.message,
                        });
                      });
                    break;
                }
              },
            }
          );

          // Now save all messages with their citations from the executeRound result
          for (const message of roundResult.messages) {
            await createMessage(
              round.id,
              message.agentId,
              message.content,
              message.toolCalls,
              message.citations
            );
            sendEvent('message-saved', {
              agentId: message.agentId,
              timestamp: new Date(),
            });
          }

          // Send done event
          sendEvent('done', {
            roundId: round.id,
            timestamp: new Date(),
          });

          isControllerClosed = true;
          controller.close();
        } catch (error) {
          console.error('Error executing round:', error);
          sendEvent('error', {
            error: 'Round execution failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
          isControllerClosed = true;
          controller.close();
        }
      },
    });

    // Return SSE stream
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('Error in round API:', error);
    return NextResponse.json(
      { error: 'Failed to start round', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
