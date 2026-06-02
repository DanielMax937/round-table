'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MovieForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '创建电影项目失败');
      }

      const { movie } = await response.json();
      router.push(`/movies/${movie.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          电影标题
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：最后一次行动"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          简介（可选）
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="简要梗概或核心设定..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !title.trim()}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? '创建中...' : '创建纯手动项目'}
      </button>
    </form>
  );
}
