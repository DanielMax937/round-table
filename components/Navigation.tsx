'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        return pathname.startsWith(path);
    };

    return (
        <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo/Home */}
                    <Link href="/" className="flex items-center">
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                            Round Table AI
                        </span>
                    </Link>

                    {/* Navigation Links */}
                    <div className="flex items-center gap-1">
                        <Link
                            href="/"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === '/'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                        >
                            New Discussion
                        </Link>
                        <Link
                            href="/discussions"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/roundtable') || isActive('/discussions')
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                        >
                            Discussions
                        </Link>
                        <Link
                            href="/votes"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/moe-vote') || isActive('/votes')
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                        >
                            Votes
                        </Link>
                        <Link
                            href="/personas"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/personas')
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                        >
                            Personas
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
