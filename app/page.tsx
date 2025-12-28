import Link from 'next/link';
import RoundTableForm from '@/components/RoundTableForm';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Round Table</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Multi-agent AI discussions on any topic
            </p>
          </div>
          <Link
            href="/history"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium"
          >
            View History
          </Link>
        </div>

        <RoundTableForm />

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
              <div className="text-3xl mb-2">1️⃣</div>
              <h3 className="font-semibold mb-2">Choose a Topic</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter any topic you'd like to discuss with AI agents
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
              <div className="text-3xl mb-2">2️⃣</div>
              <h3 className="font-semibold mb-2">Agents Discuss</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Multiple AI agents with different perspectives discuss your topic
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
              <div className="text-3xl mb-2">3️⃣</div>
              <h3 className="font-semibold mb-2">Continue Rounds</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Start new rounds to deepen the discussion
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
