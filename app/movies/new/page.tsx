import MovieForm from '@/components/MovieForm';
import Link from 'next/link';

export default function NewMoviePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/movies"
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            &larr; 返回电影项目
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">纯手动建档</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            只创建电影档案，后续角色、场景和内容都由你手动添加。
          </p>
          <MovieForm />
        </div>
      </div>
    </div>
  );
}
