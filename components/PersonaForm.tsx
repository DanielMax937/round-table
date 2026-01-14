'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Persona {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    isDefault: boolean;
    createdAt: Date;
}

interface PersonaFormProps {
    persona?: Persona;
    onSave: (persona: Persona) => void;
    onCancel: () => void;
}

export default function PersonaForm({ persona, onSave, onCancel }: PersonaFormProps) {
    const [name, setName] = useState(persona?.name || '');
    const [description, setDescription] = useState(persona?.description || '');
    const [systemPrompt, setSystemPrompt] = useState(persona?.systemPrompt || '');
    const [isDefault, setIsDefault] = useState(persona?.isDefault || false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);

        try {
            const url = persona ? `/api/personas/${persona.id}` : '/api/personas';
            const method = persona ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    systemPrompt,
                    isDefault,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save persona');
            }

            const data = await response.json();
            onSave(data.persona);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Name *
                </label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    placeholder="e.g., The Analyst"
                />
            </div>

            <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                    Description *
                </label>
                <input
                    type="text"
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    placeholder="Brief description of the persona's role"
                />
            </div>

            <div>
                <label htmlFor="systemPrompt" className="block text-sm font-medium mb-2">
                    System Prompt *
                </label>
                <textarea
                    id="systemPrompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    required
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 font-mono text-sm"
                    placeholder="You are [role]. Your role is to:&#10;- [Responsibility 1]&#10;- [Responsibility 2]"
                />
            </div>

            <div className="flex items-center">
                <input
                    type="checkbox"
                    id="isDefault"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isDefault" className="ml-2 text-sm">
                    Mark as default persona
                </label>
            </div>

            <div className="flex gap-2 pt-4">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? 'Saving...' : persona ? 'Update Persona' : 'Create Persona'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
