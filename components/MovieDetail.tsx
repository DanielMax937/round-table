'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Character {
  id: string;
  name: string;
  backstory: string;
  personalityTraits: string;
}

interface Scene {
  id: string;
  sceneNumber: number;
  heading: string;
  description: string;
  status: string;
  finalizedScript: string | null;
  sceneCharacters: Array<{ character: { name: string } }>;
  roundTable: { _count: { rounds: number } };
}

interface MovieDetailProps {
  movieId: string;
  title: string;
  description: string | null;
  characters: Character[];
  scenes: Scene[];
}

export default function MovieDetail({ movieId, title, description, characters, scenes }: MovieDetailProps) {
  const router = useRouter();

  // Character form state
  const [showCharForm, setShowCharForm] = useState(false);
  const [charName, setCharName] = useState('');
  const [charBackstory, setCharBackstory] = useState('');
  const [charTraits, setCharTraits] = useState('');
  const [charSubmitting, setCharSubmitting] = useState(false);
  const [editingChar, setEditingChar] = useState<string | null>(null);

  // Scene form state
  const [showSceneForm, setShowSceneForm] = useState(false);
  const [sceneHeading, setSceneHeading] = useState('');
  const [sceneDesc, setSceneDesc] = useState('');
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [sceneMaxRounds, setSceneMaxRounds] = useState(10);
  const [sceneSubmitting, setSceneSubmitting] = useState(false);

  const [error, setError] = useState('');

  const resetCharForm = () => {
    setCharName('');
    setCharBackstory('');
    setCharTraits('');
    setEditingChar(null);
    setShowCharForm(false);
  };

  const handleAddCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim() || !charBackstory.trim() || !charTraits.trim()) return;

    setCharSubmitting(true);
    setError('');

    try {
      const url = editingChar
        ? `/api/movies/${movieId}/characters/${editingChar}`
        : `/api/movies/${movieId}/characters`;

      const response = await fetch(url, {
        method: editingChar ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: charName,
          backstory: charBackstory,
          personalityTraits: charTraits,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save character');
      }

      resetCharForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCharSubmitting(false);
    }
  };

  const handleDeleteCharacter = async (charId: string) => {
    if (!confirm('Delete this character?')) return;

    try {
      await fetch(`/api/movies/${movieId}/characters/${charId}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError('Failed to delete character');
    }
  };

  const startEditCharacter = (char: Character) => {
    setCharName(char.name);
    setCharBackstory(char.backstory);
    setCharTraits(char.personalityTraits);
    setEditingChar(char.id);
    setShowCharForm(true);
  };

  const toggleCharSelection = (charId: string) => {
    setSelectedChars(prev =>
      prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]
    );
  };

  const handleCreateScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneHeading.trim() || !sceneDesc.trim() || selectedChars.length < 2) return;

    setSceneSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/movies/${movieId}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heading: sceneHeading,
          description: sceneDesc,
          characterIds: selectedChars,
          maxRounds: sceneMaxRounds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create scene');
      }

      const { scene } = await response.json();
      router.push(`/movies/${movieId}/scenes/${scene.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSceneSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Movie Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
        {description && <p className="text-gray-600 dark:text-gray-400">{description}</p>}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Characters Section */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Characters ({characters.length})</h2>
          <button
            onClick={() => { resetCharForm(); setShowCharForm(!showCharForm); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            {showCharForm ? 'Cancel' : '+ Add Character'}
          </button>
        </div>

        {showCharForm && (
          <form onSubmit={handleAddCharacter} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
            <input
              type="text"
              value={charName}
              onChange={e => setCharName(e.target.value)}
              placeholder="Character name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />
            <textarea
              value={charBackstory}
              onChange={e => setCharBackstory(e.target.value)}
              placeholder="Backstory - who is this character? What's their history?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />
            <textarea
              value={charTraits}
              onChange={e => setCharTraits(e.target.value)}
              placeholder="Personality traits - how do they talk? What's their attitude?"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />
            <button
              type="submit"
              disabled={charSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium transition-colors"
            >
              {charSubmitting ? 'Saving...' : editingChar ? 'Update Character' : 'Add Character'}
            </button>
          </form>
        )}

        {characters.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No characters yet. Add some to get started.</p>
        ) : (
          <div className="grid gap-3">
            {characters.map(char => (
              <div key={char.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{char.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{char.backstory}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">{char.personalityTraits}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => startEditCharacter(char)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCharacter(char.id)}
                      className="text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scenes Section */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Scenes ({scenes.length})</h2>
          {characters.length >= 2 && (
            <button
              onClick={() => setShowSceneForm(!showSceneForm)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
            >
              {showSceneForm ? 'Cancel' : '+ New Scene'}
            </button>
          )}
        </div>

        {characters.length < 2 && (
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Add at least 2 characters before creating scenes.
          </p>
        )}

        {showSceneForm && (
          <form onSubmit={handleCreateScene} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
            <input
              type="text"
              value={sceneHeading}
              onChange={e => setSceneHeading(e.target.value)}
              placeholder="Scene heading (e.g. INT. COFFEE SHOP - NIGHT)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />
            <textarea
              value={sceneDesc}
              onChange={e => setSceneDesc(e.target.value)}
              placeholder="Scene description - what's happening? What's the mood?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Characters ({selectedChars.length} selected, min 2)
              </label>
              <div className="flex flex-wrap gap-2">
                {characters.map(char => (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => toggleCharSelection(char.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedChars.includes(char.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                    }`}
                  >
                    {char.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Dialogue Rounds
              </label>
              <input
                type="number"
                value={sceneMaxRounds}
                onChange={e => setSceneMaxRounds(parseInt(e.target.value) || 10)}
                min={1}
                max={50}
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={sceneSubmitting || selectedChars.length < 2}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium transition-colors"
            >
              {sceneSubmitting ? 'Creating...' : 'Create Scene'}
            </button>
          </form>
        )}

        {scenes.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No scenes yet.</p>
        ) : (
          <div className="grid gap-3">
            {scenes.map(scene => (
              <Link
                key={scene.id}
                href={`/movies/${movieId}/scenes/${scene.id}`}
                className="block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Scene {scene.sceneNumber}: {scene.heading}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {scene.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{scene.sceneCharacters.map(sc => sc.character.name).join(', ')}</span>
                      <span>-</span>
                      <span>{scene.roundTable._count.rounds} rounds</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {scene.finalizedScript ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Finalized
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        In Progress
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
