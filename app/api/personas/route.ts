import { NextRequest, NextResponse } from 'next/server';
import {
    getAllPersonas,
    createPersona,
    type CreatePersonaInput,
} from '@/lib/db/personas';

/**
 * GET /api/personas - Get all personas
 */
export async function GET() {
    try {
        const personas = await getAllPersonas();
        return NextResponse.json({ personas });
    } catch (error) {
        console.error('Error fetching personas:', error);
        return NextResponse.json(
            { error: 'Failed to fetch personas' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/personas - Create a new persona
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.description || !body.systemPrompt) {
            return NextResponse.json(
                { error: 'Missing required fields: name, description, systemPrompt' },
                { status: 400 }
            );
        }

        const personaData: CreatePersonaInput = {
            name: body.name,
            description: body.description,
            systemPrompt: body.systemPrompt,
            isDefault: body.isDefault ?? false,
        };

        const persona = await createPersona(personaData);

        return NextResponse.json({ persona }, { status: 201 });
    } catch (error) {
        console.error('Error creating persona:', error);
        return NextResponse.json(
            { error: 'Failed to create persona' },
            { status: 500 }
        );
    }
}
