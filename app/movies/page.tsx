import Link from 'next/link';
import MovieDeleteButton from '@/components/MovieDeleteButton';

async function getMovies() {
  try {
    const response = await fetch('http://localhost:8400/api/movies', { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return data.movies || [];
  } catch {
    return [];
  }
}

export const dynamic = 'force-dynamic';

export default async function MoviesPage() {
  const movies = await getMovies();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">电影项目</h1>
          <div className="flex gap-2">
            <Link
              href="/movies/new/ai"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + 系统自动创作
            </Link>
            <Link
              href="/movies/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + 纯手动建档
            </Link>
          </div>
        </div>

        {movies.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              暂无电影项目。先创建一个吧。
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {movies.map((movie: any) => (
              <div
                key={movie.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/movies/${movie.id}`} className="block flex-1 min-w-0">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {movie.title}
                      </h2>
                      {movie.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                          {movie.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{movie._count?.characters || 0} 个角色</span>
                        <span>{movie._count?.scenes || 0} 场戏</span>
                        <span>{new Date(movie.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={`/movies/${movie.id}`}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-center"
                    >
                      编辑
                    </Link>
                    <Link
                      href={`/movies/${movie.id}/workflow`}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 text-center"
                    >
                      AI 产制
                    </Link>
                    <MovieDeleteButton movieId={movie.id} movieTitle={movie.title} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
