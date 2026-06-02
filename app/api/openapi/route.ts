import { NextResponse } from 'next/server';

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: '圆桌 API',
    description: '多智能体 AI 讨论平台。智能体基于不同人格实时讨论主题，并可使用网页搜索。',
    version: '0.1.0',
  },
  servers: [{ url: '/', description: '当前服务器' }],
  paths: {
    '/api/health': {
      get: {
        summary: '健康检查',
        tags: ['系统'],
        responses: { 200: { description: '服务正常', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } } } },
      },
    },
    '/api/roundtable': {
      get: {
        summary: '列出所有圆桌讨论',
        tags: ['圆桌讨论'],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'paused', 'archived'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { 200: { description: '圆桌讨论列表' } },
      },
      post: {
        summary: '创建圆桌讨论',
        tags: ['圆桌讨论'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['topic', 'agentCount'],
                properties: {
                  topic: { type: 'string', description: '讨论主题' },
                  agentCount: { type: 'integer', minimum: 2, maximum: 6 },
                  maxRounds: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
                  customPersonas: { type: 'array', items: { type: 'string' } },
                  selectedPersonaIds: { type: 'array', items: { type: 'string' } },
                  language: { type: 'string', enum: ['en', 'zh'], default: 'zh' },
                },
              },
            },
          },
        },
        responses: { 201: { description: '圆桌讨论已创建' }, 400: { description: '参数校验错误' } },
      },
    },
    '/api/roundtable/{id}': {
      get: {
        summary: '获取圆桌讨论',
        tags: ['圆桌讨论'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: { 200: { description: '圆桌讨论详情' }, 404: { description: '不存在' } },
      },
      patch: {
        summary: '更新圆桌讨论状态',
        tags: ['圆桌讨论'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string', enum: ['active', 'paused', 'archived'] } },
              },
            },
          },
        },
        responses: { 200: { description: '已更新' }, 404: { description: '不存在' } },
      },
      delete: {
        summary: '删除圆桌讨论',
        tags: ['圆桌讨论'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: { 200: { description: '已删除' }, 404: { description: '不存在' } },
      },
    },
    '/api/roundtable/{id}/round': {
      post: {
        summary: '启动新轮次（SSE）',
        description: '返回 Server-Sent Events 流。事件包括 round-start、agent-start、chunk、tool-call、agent-complete、round-complete、done。',
        tags: ['圆桌讨论'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: {
          200: { description: 'SSE 流（Content-Type: text/event-stream）' },
          404: { description: '圆桌讨论不存在' },
        },
      },
    },
    '/api/roundtable/{id}/blog-post': {
      post: {
        summary: '生成博客文章（SSE）',
        description: '将讨论整理为 Markdown 博客文章，并返回 SSE 流。',
        tags: ['圆桌讨论'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: {
          200: { description: 'SSE 流' },
          404: { description: '圆桌讨论不存在' },
        },
      },
    },
    '/api/personas': {
      get: { summary: '列出智能体人格', tags: ['智能体人格'], responses: { 200: { description: '全部智能体人格' } } },
      post: {
        summary: '创建智能体人格',
        tags: ['智能体人格'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'description', 'systemPrompt'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  systemPrompt: { type: 'string' },
                  descriptionZh: { type: 'string' },
                  isDefault: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: { 201: { description: '智能体人格已创建' } },
      },
    },
    '/api/personas/{id}': {
      get: { summary: '获取智能体人格', tags: ['智能体人格'], parameters: [{ name: 'id', in: 'path', required: true }], responses: { 200: {} } },
    },
    '/api/moe-vote': {
      get: { summary: '列出混合专家投票任务', tags: ['混合专家投票'], responses: { 200: { description: '全部任务' } } },
      post: {
        summary: '创建混合专家投票任务',
        description: '异步任务：多智能体讨论 + 投票。通过 /api/moe-vote/{jobId} 轮询状态。',
        tags: ['混合专家投票'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['question'],
                properties: {
                  question: { type: 'string' },
                  includeDiscussionAgentsInVoting: { type: 'boolean', default: false },
                  agentCount: { type: 'integer', default: 3, minimum: 2, maximum: 6 },
                  language: { type: 'string', enum: ['en', 'zh'], default: 'zh' },
                  maxRounds: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 201: { description: '任务 ID 和预计完成时间' } },
      },
    },
    '/api/moe-vote/{jobId}': {
      get: {
        summary: '获取混合专家投票任务状态',
        tags: ['混合专家投票'],
        parameters: [{ name: 'jobId', in: 'path', required: true }],
        responses: { 200: { description: '状态、进度、结果（完成后）' }, 404: { description: '不存在' } },
      },
      delete: {
        summary: '删除混合专家投票任务',
        tags: ['混合专家投票'],
        parameters: [{ name: 'jobId', in: 'path', required: true }],
        responses: { 200: { description: '已删除' }, 404: { description: '不存在' } },
      },
    },
    '/api/discussion': {
      post: {
        summary: '创建讨论任务',
        description: '异步多轮讨论。通过 /api/discussion/{jobId} 轮询状态。',
        tags: ['讨论'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['topic', 'agentCount', 'maxRounds', 'selectedPersonaIds'],
                properties: {
                  topic: { type: 'string' },
                  agentCount: { type: 'integer', minimum: 1 },
                  maxRounds: { type: 'integer', minimum: 1 },
                  selectedPersonaIds: { type: 'array', items: { type: 'string' } },
                  language: { type: 'string', default: 'zh' },
                },
              },
            },
          },
        },
        responses: { 201: { description: '任务 ID、圆桌讨论 ID 和状态' } },
      },
    },
    '/api/discussion/{jobId}': {
      get: {
        summary: '获取讨论任务状态',
        tags: ['讨论'],
        parameters: [{ name: 'jobId', in: 'path', required: true }],
        responses: { 200: { description: '状态、进度和圆桌讨论' }, 404: { description: '不存在' } },
      },
    },
  },
  components: {
    schemas: {
      Health: {
        type: 'object',
        properties: { status: { type: 'string', example: 'ok' }, timestamp: { type: 'string', format: 'date-time' } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
