import BuzzyAgentStudio from '@/components/BuzzyAgentStudio';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<{ movieId?: string }>;
}

export default async function BuzzyAgentPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  return <BuzzyAgentStudio initialMovieId={resolvedSearchParams?.movieId} />;
}
