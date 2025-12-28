// GET /api/roundtable/[id] - Get a specific round table
// PATCH /api/roundtable/[id] - Update round table status

import { NextRequest, NextResponse } from 'next/server';
import { getRoundTableWithDetails, updateRoundTableStatus, roundTableExists } from '@/lib/db/roundtable';
import { deleteRoundTable } from '@/lib/db/roundtable';
import { getRoundsWithMessages } from '@/lib/db/rounds';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/roundtable/[id] - Get a specific round table with details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if round table exists
    const exists = await roundTableExists(id);
    if (!exists) {
      return NextResponse.json({ error: 'Round table not found' }, { status: 404 });
    }

    // Get round table with details
    const roundTable = await getRoundTableWithDetails(id);

    if (!roundTable) {
      return NextResponse.json({ error: 'Round table not found' }, { status: 404 });
    }

    // Parse tool calls in messages
    const roundsWithParsedMessages = roundTable.rounds.map((round) => ({
      ...round,
      messages: round.messages.map((msg) => ({
        ...msg,
        toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined,
      })),
    }));

    return NextResponse.json({
      roundTable: {
        id: roundTable.id,
        topic: roundTable.topic,
        agentCount: roundTable.agentCount,
        status: roundTable.status,
        createdAt: roundTable.createdAt,
        updatedAt: roundTable.updatedAt,
        agents: roundTable.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          persona: agent.persona,
          order: agent.order,
        })),
        rounds: roundsWithParsedMessages.map((round) => ({
          id: round.id,
          roundNumber: round.roundNumber,
          status: round.status,
          createdAt: round.createdAt,
          completedAt: round.completedAt,
          messageCount: round.messages.length,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching round table:', error);
    return NextResponse.json(
      { error: 'Failed to fetch round table', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/roundtable/[id] - Update round table status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || !['active', 'paused', 'archived'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be one of: active, paused, archived' },
        { status: 400 }
      );
    }

    // Check if round table exists
    const exists = await roundTableExists(id);
    if (!exists) {
      return NextResponse.json({ error: 'Round table not found' }, { status: 404 });
    }

    // Update status
    const updated = await updateRoundTableStatus(id, status);

    return NextResponse.json({
      roundTable: {
        id: updated.id,
        topic: updated.topic,
        agentCount: updated.agentCount,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating round table:', error);
    return NextResponse.json(
      { error: 'Failed to update round table', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/roundtable/[id] - Delete a round table
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if round table exists
    const exists = await roundTableExists(id);
    if (!exists) {
      return NextResponse.json({ error: 'Round table not found' }, { status: 404 });
    }

    // Delete round table (cascade delete handles agents, rounds, messages)
    await deleteRoundTable(id);

    return NextResponse.json({ success: true, message: 'Round table deleted' });
  } catch (error) {
    console.error('Error deleting round table:', error);
    return NextResponse.json(
      { error: 'Failed to delete round table', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
