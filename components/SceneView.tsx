'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MessageBubble from './MessageBubble';
import AgentIndicator from './AgentIndicator';
import { ScriptModal } from './ScriptModal';

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
    toolCalls?: any[];
    citations?: string;
    createdAt: Date;
    agent: Agent;
  }>;
}

interface SceneViewProps {
  movieId: string;
  sceneId: string;
  sceneHeading: string;
  sceneDescription: string;
  roundTableId: string;
  agents: Agent[];
  rounds: Round[];
  status: string;
  maxRounds: number;
  finalizedScript: string | null;
  characters: Array<{ name: string }>;
}

export default function SceneView({
  movieId,
  sceneId,
  sceneHeading,
  sceneDescription,
  roundTableId,
  agents,
  rounds,
  status,
  maxRounds,
  finalizedScript,
  characters,
}: SceneViewProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentRound, setCurrentRound] = useState(rounds.length);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<{ id: string; name: string } | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<any[]>([]);
  const [completedMessages, setCompletedMessages] = useState<Array<{
    agentId: string;
    agentName: string;
    content: string;
    toolCalls: any[];
    citations: any[];
  }>>([]);
  const [error, setError] = useState('');
  const [showScriptModal, setShowScriptModal] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [rounds, streamingContent]);

  const startNextRound = async () => {
    if (isStreaming) return;

    setIsStreaming(true);
    setError('');
    setStreamingContent('');
    setStreamingToolCalls([]);
    setCompletedMessages([]);

    try {
      const response = await fetch(`/api/roundtable/${roundTableId}/round`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start round');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';
      let currentEventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventType = line.substring(6).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            const data = JSON.parse(line.substring(5).trim());
            handleSSEEvent(currentEventType, data);
            currentEventType = '';
          }
        }
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsStreaming(false);
      setCurrentAgent(null);
      setStreamingContent('');
      setStreamingToolCalls([]);
    }
  };

  const handleSSEEvent = (eventType: string, data: any) => {
    switch (eventType) {
      case 'agent-start':
        setCurrentAgent({ id: data.agentId, name: data.agentName });
        setStreamingContent('');
        setStreamingToolCalls([]);
        break;
      case 'chunk':
        setStreamingContent(prev => prev + data.chunk);
        break;
      case 'tool-call':
        setStreamingToolCalls(prev => [...prev, data.toolCall]);
        break;
      case 'agent-complete':
        if (currentAgent && streamingContent) {
          setCompletedMessages(prev => [...prev, {
            agentId: currentAgent.id,
            agentName: currentAgent.name,
            content: streamingContent,
            toolCalls: streamingToolCalls,
            citations: [],
          }]);
        }
        setStreamingContent('');
        setStreamingToolCalls([]);
        break;
      case 'error':
        setError(data.error || 'An error occurred');
        break;
    }
  };

  const canStartRound = status === 'active' && !isStreaming && currentRound < maxRounds;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Scene Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{sceneHeading}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-3">{sceneDescription}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Round {currentRound} of {maxRounds}</span>
          <span>-</span>
          <span>{characters.map(c => c.name).join(', ')}</span>
          {finalizedScript && (
            <>
              <span>-</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Finalized</span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Dialogue Messages */}
      <div className="space-y-4 mb-6">
        {rounds.map(round => (
          <div key={round.id}>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Round {round.roundNumber}</h3>
            </div>
            {round.messages.map(message => (
              <MessageBubble
                key={message.id}
                agentName={message.agent.name}
                content={message.content}
                toolCalls={message.toolCalls || []}
                timestamp={new Date(message.createdAt)}
              />
            ))}
          </div>
        ))}

        {/* Completed messages from current streaming round */}
        {completedMessages.length > 0 && (
          <div>
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Round {currentRound + 1}</h3>
            </div>
            {completedMessages.map((msg, i) => (
              <MessageBubble
                key={`completed-${i}`}
                agentName={msg.agentName}
                content={msg.content}
                toolCalls={msg.toolCalls}
                timestamp={new Date()}
              />
            ))}
          </div>
        )}

        {/* Currently streaming message */}
        {isStreaming && currentAgent && (
          <>
            {streamingContent ? (
              <MessageBubble
                agentName={currentAgent.name}
                content={streamingContent}
                toolCalls={streamingToolCalls}
                timestamp={new Date()}
                isStreaming
              />
            ) : (
              <AgentIndicator agentName={currentAgent.name} isThinking />
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={startNextRound}
            disabled={!canStartRound}
            className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
              canStartRound
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
            }`}
          >
            {isStreaming ? 'Dialogue in progress...' : `Continue Dialogue (Round ${currentRound + 1})`}
          </button>

          <button
            onClick={() => setShowScriptModal(true)}
            disabled={isStreaming || rounds.length === 0}
            className="px-4 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            Finalize Script
          </button>
        </div>
      </div>

      <ScriptModal
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        movieId={movieId}
        sceneId={sceneId}
        sceneHeading={sceneHeading}
      />
    </div>
  );
}
