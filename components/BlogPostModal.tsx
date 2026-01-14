'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface BlogPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  roundTableId: string;
  topic: string;
}

export function BlogPostModal({ isOpen, onClose, roundTableId, topic }: BlogPostModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [blogPostEn, setBlogPostEn] = useState('');
  const [blogPostZh, setBlogPostZh] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'zh'>('en');
  const [generatingLanguage, setGeneratingLanguage] = useState<'en' | 'zh' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup AbortController on unmount or when modal closes
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Abort ongoing request when modal closes during generation
  useEffect(() => {
    if (!isOpen && isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [isOpen, isGenerating]);

  // Keyboard navigation - ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const generateBlogPost = async () => {
    setIsGenerating(true);
    setError(null);
    setBlogPostEn('');
    setBlogPostZh('');
    setGeneratingLanguage(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/roundtable/${roundTableId}/blog-post`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate blog post');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // Event type line
            continue;
          } else if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.language) {
                setGeneratingLanguage(data.language);
              }

              if (data.chunk) {
                if (data.language === 'en') {
                  setBlogPostEn(prev => prev + data.chunk);
                } else if (data.language === 'zh') {
                  setBlogPostZh(prev => prev + data.chunk);
                }
              } else if (data.error) {
                setError(data.error);
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', line, parseError);
            }
          }
        }
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
      setGeneratingLanguage(null);
      abortControllerRef.current = null;
    }
  };

  const downloadMarkdown = () => {
    const content = currentLanguage === 'en' ? blogPostEn : blogPostZh;
    const suffix = currentLanguage === 'en' ? 'en' : 'zh';
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic.toLowerCase().replace(/\s+/g, '-')}-${suffix}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    const content = currentLanguage === 'en' ? blogPostEn : blogPostZh;
    await navigator.clipboard.writeText(content);
  };

  const currentBlogPost = currentLanguage === 'en' ? blogPostEn : blogPostZh;
  const hasBothLanguages = blogPostEn && blogPostZh;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blog-post-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <h2 id="blog-post-modal-title" className="text-2xl font-bold text-gray-900">Generate Blog Post</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isGenerating && !currentBlogPost && !error && (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-6">
                Generate a Substack-ready blog post in both English and Chinese from this round table discussion on:
              </p>
              <p className="text-xl font-semibold text-gray-900 mb-8">"{topic}"</p>
              <button
                onClick={generateBlogPost}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Generate Blog Post
              </button>
            </div>
          )}

          {/* Language Switcher - show when both versions exist */}
          {hasBothLanguages && !isGenerating && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCurrentLanguage('en')}
                className={`px-4 py-2 rounded font-medium transition-colors ${currentLanguage === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                English
              </button>
              <button
                onClick={() => setCurrentLanguage('zh')}
                className={`px-4 py-2 rounded font-medium transition-colors ${currentLanguage === 'zh'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                中文
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-blue-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span>
                  {generatingLanguage === 'en' && 'Generating English version...'}
                  {generatingLanguage === 'zh' && 'Generating Chinese version (生成中文版本)...'}
                  {!generatingLanguage && 'Synthesizing discussion into blog post...'}
                </span>
              </div>
              {currentBlogPost && (
                <div className="prose prose-sm max-w-none text-black [&_*]:text-black [&_a]:text-blue-600 [&_a]:no-underline hover:[&_a]:underline">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {currentBlogPost}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {!isGenerating && currentBlogPost && (
            <div className="prose prose-sm max-w-none text-black [&_*]:text-black [&_a]:text-blue-600 [&_a]:no-underline hover:[&_a]:underline">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentBlogPost}
              </ReactMarkdown>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
              Error: {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {currentBlogPost && !isGenerating && (
          <div className="p-6 border-t flex gap-3 justify-end">
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={downloadMarkdown}
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Download Markdown ({currentLanguage === 'en' ? 'EN' : '中文'})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
