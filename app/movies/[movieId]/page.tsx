import { notFound } from 'next/navigation';
import Link from 'next/link';
import MovieDetail from '@/components/MovieDetail';
import { getMovieWithDetails } from '@/lib/db/movies';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ movieId: string }>;
}

export default async function MoviePage({ params }: PageProps) {
  const { movieId } = await params;
  const movie = await getMovieWithDetails(movieId);

  if (!movie) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/movies"
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            &larr; Back to Movies
          </Link>
        </div>

        <MovieDetail
          movieId={movie.id}
          title={movie.title}
          description={movie.description}
          characters={movie.characters}
          scenes={movie.scenes}
        />
      </div>
    </main>
  );
}
