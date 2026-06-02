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
            { error: '获取智能体人格失败' },
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
                { error: '缺少必填字段：name、description、systemPrompt' },
                { status: 400 }
            );
        }

        const personaData: CreatePersonaInput = {
            name: body.name,
            description: body.description,
            systemPrompt: body.systemPrompt,
            descriptionZh: body.descriptionZh,
            isDefault: body.isDefault ?? false,
        };

        const persona = await createPersona(personaData);

        return NextResponse.json({ persona }, { status: 201 });
    } catch (error) {
        console.error('Error creating persona:', error);
        return NextResponse.json(
            { error: '创建智能体人格失败' },
            { status: 500 }
        );
    }
}
