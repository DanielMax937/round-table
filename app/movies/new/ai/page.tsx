'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewAIScreenplayPage() {
  const router = useRouter();
  const [theme, setTheme] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || `AI 剧本：${theme.substring(0, 30)}`,
          theme: theme.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '创建失败');

      router.push(`/movies/${data.movie.id}/workflow`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-xl mx-auto">
        <Link href="/movies" className="text-blue-500 hover:text-blue-600 text-sm font-medium mb-6 inline-block">
          &larr; 返回电影项目
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          系统自动创作
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          从一个主题开始，系统按流程生成故事提案、开发材料、角色、大纲、剧本、小说、图片和视频。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ai-theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              电影主题 *
            </label>
            <input
              id="ai-theme"
              type="text"
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="例如：赛博朋克、复仇、爱情喜剧、末日生存"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="ai-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              项目标题（可选）
            </label>
            <input
              id="ai-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="留空则自动生成"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? '创建中...' : '进入系统自动创作'}
          </button>
        </form>
      </div>
    </div>
  );
}
