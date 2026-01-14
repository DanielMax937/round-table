'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PersonaForm from '@/components/PersonaForm';

interface Persona {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    isDefault: boolean;
    createdAt: Date;
}

export default function PersonasPage() {
    const router = useRouter();
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPersonas();
    }, []);

    const fetchPersonas = async () => {
        try {
            const response = await fetch('/api/personas');
            if (!response.ok) throw new Error('Failed to fetch personas');
            const data = await response.json();
            setPersonas(data.personas);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load personas');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`/api/personas/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete persona');
            }

            await fetchPersonas();
            setDeleteConfirm(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete persona');
        }
    };

    const handleSave = async (persona: Persona) => {
        await fetchPersonas();
        setShowForm(false);
        setEditingPersona(null);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Loading personas...</div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-3xl font-bold">Agent Personas</h1>
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                        ← Back to Home
                    </button>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    Manage agent personas for round table discussions
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                    {error}
                    <button
                        onClick={() => setError('')}
                        className="ml-4 text-sm underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Create/Edit Form */}
            {showForm && (
                <div className="mb-8 p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">
                        {editingPersona ? 'Edit Persona' : 'Create New Persona'}
                    </h2>
                    <PersonaForm
                        persona={editingPersona || undefined}
                        onSave={handleSave}
                        onCancel={() => {
                            setShowForm(false);
                            setEditingPersona(null);
                        }}
                    />
                </div>
            )}

            {/* Create Button */}
            {!showForm && (
                <button
                    onClick={() => setShowForm(true)}
                    className="mb-6 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                >
                    + Create New Persona
                </button>
            )}

            {/* Personas List */}
            <div className="space-y-4">
                {personas.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        No personas found. Create one to get started!
                    </div>
                ) : (
                    personas.map((persona) => (
                        <div
                            key={persona.id}
                            className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xl font-semibold">{persona.name}</h3>
                                        {persona.isDefault && (
                                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                                        {persona.description}
                                    </p>
                                    <details className="text-sm">
                                        <summary className="cursor-pointer text-blue-500 hover:text-blue-600">
                                            View System Prompt
                                        </summary>
                                        <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs overflow-x-auto whitespace-pre-wrap">
                                            {persona.systemPrompt}
                                        </pre>
                                    </details>
                                </div>

                                <div className="flex gap-2 ml-4">
                                    <button
                                        onClick={() => {
                                            setEditingPersona(persona);
                                            setShowForm(true);
                                        }}
                                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                                    >
                                        Edit
                                    </button>

                                    {deleteConfirm === persona.id ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleDelete(persona.id)}
                                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirm(persona.id)}
                                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
