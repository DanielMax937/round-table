import Link from 'next/link';

async function getMovies() {
  try {
    const response = await fetch('http://localhost:3002/api/movies', { cache: 'no-store' });
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Movies</h1>
          <Link
            href="/movies/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Movie
          </Link>
        </div>

        {movies.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No movies yet. Create your first one!
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {movies.map((movie: any) => (
              <Link key={movie.id} href={`/movies/${movie.id}`} className="block">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {movie.title}
                      </h2>
                      {movie.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                          {movie.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{movie._count?.characters || 0} characters</span>
                        <span>{movie._count?.scenes || 0} scenes</span>
                        <span>{new Date(movie.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
