import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMovieWithDetails } from '@/lib/db/movies';
import WorkflowWizard from '@/components/WorkflowWizard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ movieId: string }>;
}

export default async function WorkflowPage({ params }: PageProps) {
  const { movieId } = await params;
  const movie = await getMovieWithDetails(movieId);

  if (!movie) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/movies"
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            &larr; Back to Movies
          </Link>
          <Link
            href={`/movies/${movieId}`}
            className="text-gray-500 hover:text-gray-600 text-sm"
          >
            传统编辑
          </Link>
        </div>

        <WorkflowWizard movie={movie} />
      </div>
    </main>
  );
}
