/**
 * AI Movie 模块 API 单测
 * 使用 vitest，mock LLM 与 Telegram
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { createMovie, getMovie, deleteMovie } from '@/lib/db/movies';
import { createSceneOutlines, getSceneOutlinesByMovie } from '@/lib/db/scene-outlines';
import { prisma } from '@/lib/prisma';

// Mock LLM & Telegram
vi.mock('@/lib/movie/story-proposals', () => ({
  generateStoryProposals: vi.fn().mockResolvedValue([
    { oneLiner: 'Proposal 1', coreConflict: 'C1', styleReference: 'S1', synopsis: 'Syn1' },
    { oneLiner: 'Proposal 2', coreConflict: 'C2', styleReference: 'S2', synopsis: 'Syn2' },
    { oneLiner: 'Proposal 3', coreConflict: 'C3', styleReference: 'S3', synopsis: 'Syn3' },
  ]),
}));

vi.mock('@/lib/movie/character-generator', () => ({
  generateCharactersFromStory: vi.fn().mockResolvedValue([
    {
      name: 'Alice',
      backstory: 'Backstory A',
      personalityTraits: 'Traits A',
      surfaceGoal: 'Goal A',
      deepMotivation: 'Mot A',
      fatalFlaw: 'Flaw A',
      signatureLanguageStyle: 'Style A',
    },
    {
      name: 'Bob',
      backstory: 'Backstory B',
      personalityTraits: 'Traits B',
      surfaceGoal: 'Goal B',
      deepMotivation: 'Mot B',
      fatalFlaw: 'Flaw B',
      signatureLanguageStyle: 'Style B',
    },
  ]),
}));

vi.mock('@/lib/movie/outline-generator', () => ({
  generateSceneOutline: vi.fn().mockImplementation(
    async (_proposal: unknown, characters: { id: string; name: string }[]) => [
      {
        title: 'INT. ROOM - DAY',
        contentSummary: 'Scene 1 summary',
        emotionalGoal: 'Tension',
        characterIds: characters.map((c) => c.id),
      },
    ]
  ),
}));

vi.mock('@/lib/movie/scene-executor', () => ({
  executeSceneWithAgents: vi.fn().mockImplementation(async (sceneId: string) => {
    const fullScript = 'INT. ROOM - DAY\n\nALICE: Hello.\nBOB: Hi.';
    const { prisma } = await import('@/lib/prisma');
    await prisma.scene.update({
      where: { id: sceneId },
      data: { finalizedScript: fullScript, status: 'draft' },
    });
    return { sceneId, fullScript, messageCount: 2 };
  }),
}));

vi.mock('@/lib/movie/rewrite', () => ({
  rewriteSceneWithFeedback: vi.fn().mockResolvedValue('INT. ROOM - DAY\n\nALICE: Hello!\nBOB: Hi!'),
}));

vi.mock('@/lib/movie/memory-settlement', () => ({
  settleMemory: vi.fn().mockResolvedValue({
    plotSummaryAddition: 'Alice and Bob met.',
    characterStateUpdates: { Alice: { emotionalState: 'calm' }, Bob: { emotionalState: 'curious' } },
  }),
}));

vi.mock('@/lib/telegram', () => ({
  sendTextToTelegram: vi.fn().mockResolvedValue(true),
  sendScriptToTelegramSeparateDialogues: vi.fn().mockResolvedValue(undefined),
}));

// Route handlers
import { POST as moviesPost, GET as moviesGet } from '../route';
import { GET as themeGet, PUT as themePut } from '../[movieId]/theme/route';
import { GET as storyProposalsGet, POST as storyProposalsPost } from '../[movieId]/story-proposals/route';
import { POST as confirmStoryPost } from '../[movieId]/confirm-story/route';
import { POST as charactersGeneratePost } from '../[movieId]/characters/generate/route';
import { POST as confirmCharactersPost } from '../[movieId]/confirm-characters/route';
import { POST as outlinePost, GET as outlineGet } from '../[movieId]/outline/route';
import { POST as confirmOutlinePost } from '../[movieId]/confirm-outline/route';
import { GET as workflowGet } from '../[movieId]/workflow/route';
import { GET as exportGet } from '../[movieId]/export/route';
import { GET as storyGet } from '../[movieId]/story/route';
import { POST as rewritePost } from '../[movieId]/scenes/[sceneId]/rewrite/route';
import { POST as settlePost } from '../[movieId]/scenes/[sceneId]/settle/route';

function jsonRequest(body: object) {
  return new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(movieId: string) {
  return { params: Promise.resolve({ movieId }) };
}

function paramsWithScene(movieId: string, sceneId: string) {
  return { params: Promise.resolve({ movieId, sceneId }) };
}

describe('AI Movie API', () => {
  let movieId: string;
  let sceneId: string;

  beforeAll(async () => {
    const movie = await createMovie({
      title: 'Test Movie',
      description: 'Test',
      theme: '赛博朋克',
    });
    movieId = movie.id;
  });

  afterAll(async () => {
    if (movieId) await deleteMovie(movieId);
  });

  describe('POST /api/movies', () => {
    test('creates movie with theme', async () => {
      const res = await moviesPost(
        jsonRequest({ title: 'AI Movie Test', theme: '复仇' })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.movie.title).toBe('AI Movie Test');
      expect(data.movie.theme).toBe('复仇');
    });

    test('rejects empty title', async () => {
      const res = await moviesPost(jsonRequest({ title: '' }));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/movies', () => {
    test('returns movies list', async () => {
      const res = await moviesGet();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.movies)).toBe(true);
    });
  });

  describe('GET/PUT /api/movies/[movieId]/theme', () => {
    test('GET returns theme', async () => {
      const res = await themeGet({} as any, params(movieId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.theme).toBe('赛博朋克');
    });

    test('PUT updates theme', async () => {
      const res = await themePut(
        jsonRequest({ theme: '爱情喜剧' }),
        params(movieId)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.theme).toBe('爱情喜剧');
    });
  });

  describe('POST /api/movies/[movieId]/story-proposals', () => {
    test('generates 3 proposals', async () => {
      const res = await storyProposalsPost(
        jsonRequest({}),
        params(movieId)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.proposals).toHaveLength(3);
      expect(data.proposals[0].oneLiner).toBe('Proposal 1');
    });

    test('GET returns proposals', async () => {
      const res = await storyProposalsGet({} as any, params(movieId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.proposals).toHaveLength(3);
    });
  });

  describe('POST /api/movies/[movieId]/confirm-story', () => {
    test('confirms by proposalIndex', async () => {
      const res = await confirmStoryPost(
        jsonRequest({ proposalIndex: 0 }),
        params(movieId)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.storyProposal.oneLiner).toBe('Proposal 1');
    });
  });

  describe('GET /api/movies/[movieId]/story', () => {
    test('returns confirmed story', async () => {
      const res = await storyGet({} as any, params(movieId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.story.oneLiner).toBe('Proposal 1');
    });
  });

  describe('POST /api/movies/[movieId]/characters/generate', () => {
    test('generates characters from story', async () => {
      const res = await charactersGeneratePost(
        jsonRequest({}),
        params(movieId)
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.characters).toHaveLength(2);
      expect(data.characters[0].name).toBe('Alice');
    });

    test('rejects when characters already exist', async () => {
      const res = await charactersGeneratePost(
        jsonRequest({}),
        params(movieId)
      );
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/movies/[movieId]/confirm-characters', () => {
    test('advances to outline phase', async () => {
      const res = await confirmCharactersPost(
        jsonRequest({}),
        params(movieId)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.workflowPhase).toBe('outline');
    });
  });

  describe('POST/GET /api/movies/[movieId]/outline', () => {
    test('generates outline', async () => {
      const res = await outlinePost(
        jsonRequest({}),
        params(movieId)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.outlines).toHaveLength(1);
      expect(data.outlines[0].title).toBe('INT. ROOM - DAY');
    });

    test('GET returns outlines', async () => {
      const res = await outlineGet({} as any, params(movieId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.outlines).toHaveLength(1);
    });
  });

  describe('POST /api/movies/[movieId]/confirm-outline', () => {
    test('advances to scene_execution', async () => {
      const res = await confirmOutlinePost(
        jsonRequest({}),
        params(movieId)
      );
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/movies/[movieId]/workflow', () => {
    test('returns workflow status', async () => {
      const res = await workflowGet({} as any, params(movieId));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.workflowPhase).toBeDefined();
      expect(data.outlineCount).toBe(1);
      expect(data.characterCount).toBe(2);
    });
  });

  describe('POST /api/movies/[movieId]/scenes/execute', () => {
    test('executes scene and returns JSON', async () => {
      const { POST: executePost } = await import('../[movieId]/scenes/execute/route');
      const res = await executePost(
        jsonRequest({ outlineIndex: 0 }),
        params(movieId)
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const data = await res.json();
      expect(data.sceneId).toBeDefined();
      expect(data.fullScript).toContain('ALICE: Hello');
    });
  });

  describe('POST /api/movies/[movieId]/scenes/[sceneId]/rewrite', () => {
    test('rewrites scene with feedback', async () => {
      const scenes = await prisma.scene.findMany({
        where: { movieId },
        take: 1,
      });
      if (scenes.length === 0) return;
      sceneId = scenes[0].id;

      const res = await rewritePost(
        jsonRequest({ feedback: '让语气更强硬' }),
        paramsWithScene(movieId, sceneId)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.script).toContain('Hello!');
    });
  });

  describe('POST /api/movies/[movieId]/scenes/[sceneId]/settle', () => {
    test('settles memory and updates status', async () => {
      const scenes = await prisma.scene.findMany({
        where: { movieId },
        take: 1,
      });
      if (scenes.length === 0) return;

      const res = await settlePost(
        jsonRequest({}),
        paramsWithScene(movieId, scenes[0].id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.plotSummaryAddition).toBeDefined();
    });
  });

  describe('GET /api/movies/[movieId]/export', () => {
    test('exports script as text', async () => {
      const res = await exportGet({} as any, params(movieId));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/plain');
      const text = await res.text();
      expect(text.toUpperCase()).toContain('TEST MOVIE');
      expect(text).toContain('ALICE: Hello');
    });
  });

  describe('GET /api/movies/[movieId]/outlines/[outlineId]', () => {
    test('returns single outline', async () => {
      const outlines = await getSceneOutlinesByMovie(movieId);
      if (outlines.length === 0) return;
      const { GET: outlineGetById } = await import('../[movieId]/outlines/[outlineId]/route');
      const res = await outlineGetById(
        {} as any,
        { params: Promise.resolve({ movieId, outlineId: outlines[0].id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.outline.id).toBe(outlines[0].id);
      expect(data.outline.characterIds).toBeDefined();
    });
  });

  describe('PATCH /api/movies/[movieId]/outlines/[outlineId]', () => {
    test('updates outline item', async () => {
      const outlines = await getSceneOutlinesByMovie(movieId);
      if (outlines.length === 0) return;
      const { PATCH: outlinePatch } = await import('../[movieId]/outlines/[outlineId]/route');
      const res = await outlinePatch(
        jsonRequest({ title: 'INT. OFFICE - NIGHT', contentSummary: 'Updated summary' }),
        { params: Promise.resolve({ movieId, outlineId: outlines[0].id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.outline.title).toBe('INT. OFFICE - NIGHT');
    });
  });

  describe('POST /api/movies/[movieId]/scenes/[sceneId]/confirm', () => {
    test('confirms scene without settle', async () => {
      const scenes = await prisma.scene.findMany({ where: { movieId }, take: 1 });
      if (scenes.length === 0) return;
      const { POST: confirmPost } = await import('../[movieId]/scenes/[sceneId]/confirm/route');
      const res = await confirmPost(
        jsonRequest({}),
        paramsWithScene(movieId, scenes[0].id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('confirmed');
    });
  });

  describe('404 handling', () => {
    test('theme GET returns 404 for invalid movie', async () => {
      const res = await themeGet({} as any, params('non-existent-id'));
      expect(res.status).toBe(404);
    });

    test('confirm-story returns 404 for invalid movie', async () => {
      const res = await confirmStoryPost(
        jsonRequest({ proposalIndex: 0 }),
        params('non-existent-id')
      );
      expect(res.status).toBe(404);
    });
  });
});
