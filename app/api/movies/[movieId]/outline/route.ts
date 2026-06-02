import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';
import { getCharactersByMovie } from '@/lib/db/characters';
import { createSceneOutlines, getSceneOutlinesByMovie } from '@/lib/db/scene-outlines';
import { generateSceneOutline } from '@/lib/movie/outline-generator';
import { parseDevelopmentReport, parseStoryBible } from '@/lib/movie/development';
import type { StoryProposal } from '@/lib/movie/types';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** POST: Generate scene outline from story + characters */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: '电影项目不存在' }, { status: 404 });
    }

    const proposalJson = movie.storyProposalJson;
    if (!proposalJson) {
      return NextResponse.json(
        { error: '尚未确认故事提案。' },
        { status: 400 }
      );
    }

    const characters = await getCharactersByMovie(movieId);
    if (characters.length === 0) {
      return NextResponse.json(
        { error: '还没有角色。请先生成角色。' },
        { status: 400 }
      );
    }
    if (!movie.developmentReportJson && !movie.storyBibleJson) {
      return NextResponse.json(
        { error: '请先生成开发读本 / 故事圣经，再生成场景大纲。' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const useFourPartStructure = body?.useFourPartStructure === true;
    const proposal = JSON.parse(proposalJson) as StoryProposal;
    const items = await generateSceneOutline(
      proposal,
      characters.map(c => ({ id: c.id, name: c.name })),
      {
        report: parseDevelopmentReport(movie.developmentReportJson),
        bible: parseStoryBible(movie.storyBibleJson),
        useFourPartStructure,
      }
    );

    await createSceneOutlines(movieId, items);
    const outlines = await getSceneOutlinesByMovie(movieId);

    const { sendTextToTelegram } = await import('@/lib/telegram');
    const outlineList = outlines.map((o: any) => `${o.sortOrder}. ${o.title}`).join('\n');
    sendTextToTelegram(
      `📋 场景大纲已生成 (${outlines.length} 场)\n\n${outlineList}\n\n请审阅并确认\n→ POST /api/movies/${movieId}/confirm-outline`
    ).catch(() => {});

    return NextResponse.json({ outlines });
  } catch (error) {
    console.error('Error generating outline:', error);
    return NextResponse.json(
      { error: '生成场景大纲失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/** GET: List scene outlines */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const outlines = await getSceneOutlinesByMovie(movieId);
    return NextResponse.json({ outlines });
  } catch (error) {
    console.error('Error fetching outline:', error);
    return NextResponse.json(
      { error: '获取场景大纲失败' },
      { status: 500 }
    );
  }
}
