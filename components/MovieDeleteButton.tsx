'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MovieDeleteButtonProps {
  movieId: string;
  movieTitle: string;
}

export default function MovieDeleteButton({ movieId, movieTitle }: MovieDeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (loading) return;
    const confirmed = window.confirm(`确认删除「${movieTitle}」吗？项目会被归档，不会物理删除。`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/movies/${movieId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '删除电影项目失败');
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除电影项目失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 disabled:opacity-50"
    >
      {loading ? '删除中...' : '删除'}
    </button>
  );
}
