'use client';

import { ToolCall } from '@/lib/types';

interface MessageBubbleProps {
  agentName: string;
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
  isStreaming?: boolean;
}

export default function MessageBubble({
  agentName,
  content,
  toolCalls = [],
  timestamp,
  isStreaming = false,
}: MessageBubbleProps) {
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`mb-6 ${isStreaming ? 'animate-pulse' : ''}`}>
      {/* Agent Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
          {agentName.charAt(0)}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">{agentName}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(timestamp)}</p>
        </div>
      </div>

      {/* Message Content */}
      <div className="ml-10 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {content.split('\n').map((paragraph, index) => (
            <p key={index} className="mb-2 last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Tool Calls */}
        {toolCalls.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            {toolCalls.map((toolCall, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className="text-lg">🔍</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    Searched for: {toolCall.query}
                  </p>
                  {toolCall.results && toolCall.results.length > 0 && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Found {toolCall.results.length} result{toolCall.results.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Streaming Indicator */}
        {isStreaming && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="animate-pulse">●</span>
            <span>Agent is responding...</span>
          </div>
        )}
      </div>
    </div>
  );
}
