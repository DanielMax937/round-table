import { NextRequest, NextResponse } from 'next/server';
import {
    getPersonaById,
    updatePersona,
    deletePersona,
    canDeletePersona,
    type UpdatePersonaInput,
} from '@/lib/db/personas';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/personas/[id] - Get persona by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        const persona = await getPersonaById(id);

        if (!persona) {
            return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
        }

        return NextResponse.json({ persona });
    } catch (error) {
        console.error('Error fetching persona:', error);
        return NextResponse.json(
            { error: 'Failed to fetch persona' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/personas/[id] - Update persona
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        const body = await request.json();

        const updateData: UpdatePersonaInput = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
        if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;

        const persona = await updatePersona(id, updateData);

        return NextResponse.json({ persona });
    } catch (error) {
        console.error('Error updating persona:', error);
        return NextResponse.json(
            { error: 'Failed to update persona' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/personas/[id] - Delete persona
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        // Check if persona can be deleted
        const { canDelete, reason } = await canDeletePersona(id);

        if (!canDelete) {
            return NextResponse.json(
                { error: reason || 'Cannot delete persona' },
                { status: 400 }
            );
        }

        const success = await deletePersona(id);

        if (!success) {
            return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting persona:', error);
        return NextResponse.json(
            { error: 'Failed to delete persona' },
            { status: 500 }
        );
    }
}
