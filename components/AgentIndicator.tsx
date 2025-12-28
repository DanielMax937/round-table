'use client';

interface AgentIndicatorProps {
  agentName: string;
  isThinking?: boolean;
  isSearching?: boolean;
}

export default function AgentIndicator({ agentName, isThinking, isSearching }: AgentIndicatorProps) {
  return (
    <div className="mb-6 ml-10">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm animate-pulse">
          {agentName.charAt(0)}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">{agentName}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isSearching ? 'Searching the web...' : 'Thinking...'}
          </p>
        </div>
      </div>

      {/* Animated dots */}
      <div className="ml-10 flex items-center gap-1">
        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </div>

      {/* Search indicator */}
      {isSearching && (
        <div className="ml-10 mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span className="animate-pulse">🔍</span>
          <span>Gathering information...</span>
        </div>
      )}
    </div>
  );
}
