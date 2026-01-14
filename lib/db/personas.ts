// Database operations for Persona model

import { prisma } from '../prisma';
import type { Persona } from '@prisma/client';

export interface CreatePersonaInput {
    name: string;
    description: string;
    systemPrompt: string;
    descriptionZh?: string | null;
    isDefault?: boolean;
}

export interface UpdatePersonaInput {
    name?: string;
    description?: string;
    systemPrompt?: string;
    descriptionZh?: string | null;
    isDefault?: boolean;
}

/**
 * Get all personas
 */
export async function getAllPersonas(): Promise<Persona[]> {
    return await prisma.persona.findMany({
        orderBy: [
            { isDefault: 'desc' }, // Default personas first
            { createdAt: 'asc' },  // Then by creation date
        ],
    });
}

/**
 * Get default personas only
 */
export async function getDefaultPersonas(): Promise<Persona[]> {
    return await prisma.persona.findMany({
        where: { isDefault: true },
        orderBy: { createdAt: 'asc' },
    });
}

/**
 * Get persona by ID
 */
export async function getPersonaById(id: string): Promise<Persona | null> {
    return await prisma.persona.findUnique({
        where: { id },
    });
}

/**
 * Create a new persona
 */
export async function createPersona(data: CreatePersonaInput): Promise<Persona> {
    return await prisma.persona.create({
        data: {
            name: data.name,
            description: data.description,
            systemPrompt: data.systemPrompt,
            descriptionZh: data.descriptionZh,
            isDefault: data.isDefault ?? false,
        },
    });
}

/**
 * Update a persona
 */
export async function updatePersona(
    id: string,
    data: UpdatePersonaInput
): Promise<Persona> {
    return await prisma.persona.update({
        where: { id },
        data,
    });
}

/**
 * Delete a persona
 * Returns true if deleted, false if not found
 */
export async function deletePersona(id: string): Promise<boolean> {
    try {
        await prisma.persona.delete({
            where: { id },
        });
        return true;
    } catch (error) {
        // Persona not found
        return false;
    }
}

/**
 * Check if a persona can be deleted
 * Cannot delete if it's being used by any agents
 */
export async function canDeletePersona(id: string): Promise<{ canDelete: boolean; reason?: string }> {
    const agentCount = await prisma.agent.count({
        where: { personaId: id },
    });

    if (agentCount > 0) {
        return {
            canDelete: false,
            reason: `This persona is being used by ${agentCount} agent(s) in discussions`,
        };
    }

    return { canDelete: true };
}
