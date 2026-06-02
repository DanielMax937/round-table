'use client';

import dynamic from 'next/dynamic';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocsPage() {
  const specUrl = '/api/openapi';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1460px] px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">圆桌 AI API</h1>
        <p className="mb-6 text-slate-600">多智能体讨论平台。你可以在下方浏览并测试接口。</p>
        <SwaggerUI url={specUrl} docExpansion="list" />
      </div>
    </div>
  );
}
