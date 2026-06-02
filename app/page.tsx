import Link from 'next/link';
import RoundTableForm from '@/components/RoundTableForm';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">圆桌讨论</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              让多个 AI 智能体围绕任意主题展开多轮讨论
            </p>
          </div>
          <Link
            href="/discussions"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium"
          >
            查看历史
          </Link>
        </div>

        <RoundTableForm />

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">使用流程</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
              <div className="text-3xl mb-2">1️⃣</div>
              <h3 className="font-semibold mb-2">选择主题</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                输入你希望 AI 智能体讨论的任意主题
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
              <div className="text-3xl mb-2">2️⃣</div>
              <h3 className="font-semibold mb-2">智能体讨论</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                多个不同视角的智能体会依次发表观点
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
              <div className="text-3xl mb-2">3️⃣</div>
              <h3 className="font-semibold mb-2">继续多轮</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                继续开启新轮次，让讨论逐步深入
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
