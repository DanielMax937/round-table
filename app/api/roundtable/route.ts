// POST /api/roundtable - Create a new round table

import { NextRequest, NextResponse } from 'next/server';
import { createRoundTable, getAllRoundTables } from '@/lib/db/roundtable';
import { getDefaultPersonas } from '@/lib/personas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, agentCount, customPersonas } = body;

    // Validate input
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    if (!agentCount || typeof agentCount !== 'number' || agentCount < 2 || agentCount > 6) {
      return NextResponse.json(
        { error: 'Agent count must be between 2 and 6' },
        { status: 400 }
      );
    }

    if (customPersonas && !Array.isArray(customPersonas)) {
      return NextResponse.json({ error: 'Custom personas must be an array' }, { status: 400 });
    }

    // Validate custom personas if provided
    if (customPersonas && customPersonas.length !== agentCount) {
      return NextResponse.json(
        { error: `Expected ${agentCount} personas, got ${customPersonas.length}` },
        { status: 400 }
      );
    }

    // Create round table
    const roundTable = await createRoundTable(topic, agentCount, customPersonas);

    return NextResponse.json(
      {
        roundTable: {
          id: roundTable.id,
          topic: roundTable.topic,
          agentCount: roundTable.agentCount,
          status: roundTable.status,
          createdAt: roundTable.createdAt,
          agents: roundTable.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            persona: agent.persona.substring(0, 100) + '...', // Truncate for response
            order: agent.order,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating round table:', error);
    return NextResponse.json(
      { error: 'Failed to create round table', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/roundtable - List all round tables

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    // Validate status if provided
    if (status && !['active', 'paused', 'archived'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Get round tables
    const roundTables = await getAllRoundTables(status as any);

    return NextResponse.json({
      roundTables: roundTables.map((rt) => ({
        id: rt.id,
        topic: rt.topic,
        agentCount: rt.agentCount,
        status: rt.status,
        createdAt: rt.createdAt,
        updatedAt: rt.updatedAt,
        agentCount: rt.agents.length,
        roundCount: rt._count?.rounds || 0,
        agents: rt.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          order: agent.order,
        })),
      })),
      total: roundTables.length,
    });
  } catch (error) {
    console.error('Error fetching round tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch round tables', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
