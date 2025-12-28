'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MessageBubble from './MessageBubble';
import AgentIndicator from './AgentIndicator';

interface Agent {
  id: string;
  name: string;
  order: number;
}

interface Round {
  id: string;
  roundNumber: number;
  status: string;
  messages: Array<{
    id: string;
    agentId: string;
    content: string;
    toolCalls?: string;
    createdAt: Date;
    agent: Agent;
  }>;
}

interface DiscussionViewProps {
  roundTableId: string;
  topic: string;
  agents: Agent[];
  rounds: Round[];
  status: string;
}

interface StreamingMessage {
  agentId: string;
  agentName: string;
  content: string;
  toolCalls: any[];
}

export default function DiscussionView({
  roundTableId,
  topic,
  agents,
  rounds,
  status,
}: DiscussionViewProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentRound, setCurrentRound] = useState<number>(rounds.length);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<{ id: string; name: string } | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [rounds, streamingContent]);

  // Fetch round table data to update
  const refreshData = async () => {
    try {
      const response = await fetch(`/api/roundtable/${roundTableId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentRound(data.roundTable.rounds.length);
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  // Start next round
  const startNextRound = async () => {
    if (isStreaming) return;

    setIsStreaming(true);
    setError('');
    setStreamingContent('');
    setStreamingToolCalls([]);

    try {
      const response = await fetch(`/api/roundtable/${roundTableId}/round`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start round');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const eventType = line.substring(6).trim();
            continue;
          }

          if (line.startsWith('data:')) {
            const data = JSON.parse(line.substring(5).trim());

            handleSSEEvent(data);
          }
        }
      }

      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsStreaming(false);
      setCurrentAgent(null);
      setStreamingContent('');
      setStreamingToolCalls([]);
    }
  };

  const handleSSEEvent = (data: any) => {
    switch (data.eventType || data.type) {
      case 'round-start':
        console.log('Round started:', data.roundNumber);
        break;

      case 'agent-start':
        setCurrentAgent({ id: data.agentId, agentName: data.agentName });
        setStreamingContent('');
        setStreamingToolCalls([]);
        break;

      case 'chunk':
        setStreamingContent((prev) => prev + data.chunk);
        break;

      case 'tool-call':
        setIsSearching(true);
        setStreamingToolCalls((prev) => [...prev, data.toolCall]);
        setTimeout(() => setIsSearching(false), 2000);
        break;

      case 'agent-complete':
        // Agent finished, reset for next agent
        break;

      case 'round-complete':
        // Round finished
        break;

      case 'done':
        // Stream complete
        break;

      case 'error':
        setError(data.error || 'An error occurred');
        break;
    }
  };

  // Update status
  const updateStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/roundtable/${roundTableId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const canStartRound = status === 'active' && !isStreaming;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">{topic}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>Round {currentRound}</span>
          <span>•</span>
          <span>{agents.length} agents</span>
          <span>•</span>
          <span className="capitalize">{status}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 mb-6">
        {rounds.map((round) => (
          <div key={round.id}>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold">Round {round.roundNumber}</h3>
            </div>
            {round.messages.map((message) => (
              <MessageBubble
                key={message.id}
                agentName={message.agent.name}
                content={message.content}
                toolCalls={message.toolCalls ? JSON.parse(message.toolCalls) : []}
                timestamp={new Date(message.createdAt)}
              />
            ))}
          </div>
        ))}

        {/* Current Streaming Message */}
        {isStreaming && currentAgent && (
          <>
            {streamingContent ? (
              <MessageBubble
                agentName={currentAgent.agentName}
                content={streamingContent}
                toolCalls={streamingToolCalls}
                timestamp={new Date()}
                isStreaming
              />
            ) : (
              <AgentIndicator
                agentName={currentAgent.agentName}
                isThinking
                isSearching={isSearching}
              />
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={startNextRound}
              disabled={!canStartRound}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                canStartRound
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              }`}
            >
              {isStreaming ? 'Discussion in progress...' : `Start Round ${currentRound + 1}`}
            </button>

            {status === 'active' && (
              <button
                onClick={() => updateStatus('paused')}
                disabled={isStreaming}
                className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Pause
              </button>
            )}

            {status === 'paused' && (
              <button
                onClick={() => updateStatus('active')}
                disabled={isStreaming}
                className="px-4 py-2 rounded-lg font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
              >
                Resume
              </button>
            )}
          </div>

          <button
            onClick={() => updateStatus('archived')}
            disabled={isStreaming}
            className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
