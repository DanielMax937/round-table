import { NextResponse } from 'next/server';

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Round Table API',
    description: 'Multi-agent AI discussion platform. Agents debate topics using distinct personas with real-time streaming and web search.',
    version: '0.1.0',
  },
  servers: [{ url: '/', description: 'Current server' }],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: { 200: { description: 'Service healthy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } } } },
      },
    },
    '/api/roundtable': {
      get: {
        summary: 'List all round tables',
        tags: ['Round Table'],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'paused', 'archived'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { 200: { description: 'List of round tables' } },
      },
      post: {
        summary: 'Create round table',
        tags: ['Round Table'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['topic', 'agentCount'],
                properties: {
                  topic: { type: 'string', description: 'Discussion topic' },
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
        responses: { 201: { description: 'Round table created' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/roundtable/{id}': {
      get: {
        summary: 'Get round table',
        tags: ['Round Table'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: { 200: { description: 'Round table details' }, 404: { description: 'Not found' } },
      },
      patch: {
        summary: 'Update round table status',
        tags: ['Round Table'],
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
        responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
      },
      delete: {
        summary: 'Delete round table',
        tags: ['Round Table'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },
    '/api/roundtable/{id}/round': {
      post: {
        summary: 'Start new round (SSE)',
        description: 'Returns Server-Sent Events stream. Events: round-start, agent-start, chunk, tool-call, agent-complete, round-complete, done',
        tags: ['Round Table'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: {
          200: { description: 'SSE stream (Content-Type: text/event-stream)' },
          404: { description: 'Round table not found' },
        },
      },
    },
    '/api/roundtable/{id}/blog-post': {
      post: {
        summary: 'Generate blog post (SSE)',
        description: 'Synthesizes discussion into markdown blog post. Returns SSE stream.',
        tags: ['Round Table'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: {
          200: { description: 'SSE stream' },
          404: { description: 'Round table not found' },
        },
      },
    },
    '/api/personas': {
      get: { summary: 'List personas', tags: ['Personas'], responses: { 200: { description: 'All personas' } } },
      post: {
        summary: 'Create persona',
        tags: ['Personas'],
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
        responses: { 201: { description: 'Persona created' } },
      },
    },
    '/api/personas/{id}': {
      get: { summary: 'Get persona', tags: ['Personas'], parameters: [{ name: 'id', in: 'path', required: true }], responses: { 200: {} } },
    },
    '/api/moe-vote': {
      get: { summary: 'List MoE vote jobs', tags: ['MoE Vote'], responses: { 200: { description: 'All jobs' } } },
      post: {
        summary: 'Create MoE vote job',
        description: 'Async job: multi-agent discussion + voting. Poll /api/moe-vote/{jobId} for status.',
        tags: ['MoE Vote'],
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
        responses: { 201: { description: 'jobId, estimatedCompletionTime' } },
      },
    },
    '/api/moe-vote/{jobId}': {
      get: {
        summary: 'Get MoE vote job status',
        tags: ['MoE Vote'],
        parameters: [{ name: 'jobId', in: 'path', required: true }],
        responses: { 200: { description: 'status, progress, result (when completed)' }, 404: { description: 'Not found' } },
      },
      delete: {
        summary: 'Delete MoE vote job',
        tags: ['MoE Vote'],
        parameters: [{ name: 'jobId', in: 'path', required: true }],
        responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },
    '/api/discussion': {
      post: {
        summary: 'Create discussion job',
        description: 'Async multi-round discussion. Poll /api/discussion/{jobId} for status.',
        tags: ['Discussion'],
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
        responses: { 201: { description: 'jobId, roundTableId, status' } },
      },
    },
    '/api/discussion/{jobId}': {
      get: {
        summary: 'Get discussion job status',
        tags: ['Discussion'],
        parameters: [{ name: 'jobId', in: 'path', required: true }],
        responses: { 200: { description: 'status, progress, roundTable' }, 404: { description: 'Not found' } },
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
