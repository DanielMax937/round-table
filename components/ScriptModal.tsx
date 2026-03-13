'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieId: string;
  sceneId: string;
  sceneHeading: string;
}

export function ScriptModal({ isOpen, onClose, movieId, sceneId, sceneHeading }: ScriptModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [script, setScript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isOpen && isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [isOpen, isGenerating]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const generateScript = async () => {
    setIsGenerating(true);
    setError(null);
    setScript('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/movies/${movieId}/scenes/${sceneId}/finalize`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to finalize script');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream available');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.chunk) {
                setScript(prev => prev + data.chunk);
              } else if (data.error) {
                setError(data.error);
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const downloadScript = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sceneHeading.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(script);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="script-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 id="script-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white">
            Finalize Script
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!isGenerating && !script && !error && (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Convert the improvised dialogue into proper screenplay format:
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white mb-8">
                &ldquo;{sceneHeading}&rdquo;
              </p>
              <button
                onClick={generateScript}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Finalize Script
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span>Writing screenplay...</span>
              </div>
              {script && (
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  {script}
                </pre>
              )}
            </div>
          )}

          {!isGenerating && script && (
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              {script}
            </pre>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4 text-red-700 dark:text-red-300">
              Error: {error}
            </div>
          )}
        </div>

        {script && !isGenerating && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={downloadScript}
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Download Script
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
