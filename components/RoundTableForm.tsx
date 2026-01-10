'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AgentPersona {
  name: string;
  persona: string;
  order: number;
}

export default function RoundTableForm() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [agentCount, setAgentCount] = useState(3);
  const [maxRounds, setMaxRounds] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPersonas, setShowPersonas] = useState(false);
  const [personas, setPersonas] = useState<AgentPersona[]>([]);

  const handleAgentCountChange = (count: number) => {
    setAgentCount(count);
    setShowPersonas(false);
  };

  const handleCreate = async () => {
    setError('');

    // Validation
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    if (agentCount < 2 || agentCount > 6) {
      setError('Agent count must be between 2 and 6');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/roundtable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic.trim(),
          agentCount,
          maxRounds,
          customPersonas: showPersonas && personas.length > 0 ? personas : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create round table');
      }

      const data = await response.json();
      router.push(`/roundtable/${data.roundTable.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Start a Round Table Discussion</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Topic Input */}
        <div className="mb-6">
          <label htmlFor="topic" className="block text-sm font-medium mb-2">
            Discussion Topic
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What topic would you like to discuss? (e.g., 'Should AI have rights?', 'The future of remote work')"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        {/* Agent Count Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Number of Agents
          </label>
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handleAgentCountChange(count)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${agentCount === count
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                disabled={isSubmitting}
              >
                {count}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {agentCount} agent{agentCount > 1 ? 's' : ''} will participate in the discussion
          </p>
        </div>

        {/* Max Rounds Input */}
        <div className="mb-6">
          <label htmlFor="maxRounds" className="block text-sm font-medium mb-2">
            Maximum Rounds
          </label>
          <input
            id="maxRounds"
            type="number"
            value={maxRounds}
            onChange={(e) => setMaxRounds(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
            min={1}
            max={50}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            disabled={isSubmitting}
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            The discussion will run for {maxRounds} round{maxRounds > 1 ? 's' : ''} (default: 5)
          </p>
        </div>

        {/* Persona Customization Toggle */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowPersonas(!showPersonas)}
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            {showPersonas ? '▼' : '▶'} Customize agent personas (optional)
          </button>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleCreate}
          disabled={isSubmitting || !topic.trim()}
          className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors ${isSubmitting || !topic.trim()
            ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
            }`}
        >
          {isSubmitting ? 'Creating...' : 'Start Discussion'}
        </button>
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
          How it works
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
          <li>• Agents will discuss your topic sequentially in rounds</li>
          <li>• Each agent has a unique perspective and personality</li>
          <li>• Agents can search the web to support their arguments</li>
          <li>• Click "Continue" to start each new round</li>
        </ul>
      </div>
    </div>
  );
}
