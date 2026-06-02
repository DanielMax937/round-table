import { NextRequest, NextResponse } from 'next/server';
import { getMovie } from '@/lib/db/movies';
import { getCharactersByMovie } from '@/lib/db/characters';
import { createCharacter } from '@/lib/db/characters';
import { generateCharactersFromStory } from '@/lib/movie/character-generator';
import { parseDevelopmentReport, parseStoryBible } from '@/lib/movie/development';
import type { StoryProposal } from '@/lib/movie/types';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** POST: Generate characters from confirmed story, create in DB */
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
        { error: '尚未确认故事提案。请先确认故事。' },
        { status: 400 }
      );
    }
    if (!movie.developmentReportJson && !movie.storyBibleJson) {
      return NextResponse.json(
        { error: '请先生成开发读本 / 故事圣经，再生成角色。' },
        { status: 400 }
      );
    }

    const proposal = JSON.parse(proposalJson) as StoryProposal;
    const profiles = await generateCharactersFromStory(proposal, {
      report: parseDevelopmentReport(movie.developmentReportJson),
      bible: parseStoryBible(movie.storyBibleJson),
    });

    const existing = await getCharactersByMovie(movieId);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: '角色已存在。请先删除角色后再重新生成。' },
        { status: 400 }
      );
    }

    const characters = await Promise.all(
      profiles.map(p =>
        createCharacter(movieId, {
          name: p.name,
          backstory: p.backstory,
          personalityTraits: p.personalityTraits,
          surfaceGoal: p.surfaceGoal,
          deepMotivation: p.deepMotivation,
          fatalFlaw: p.fatalFlaw,
          signatureLanguageStyle: p.signatureLanguageStyle,
        })
      )
    );

    const { sendTextToTelegram } = await import('@/lib/telegram');
    const charList = characters
      .map((c: any) => `• ${c.name}: ${(c.personalityTraits || '').slice(0, 50)}${(c.personalityTraits || '').length > 50 ? '...' : ''}`)
      .join('\n');
    sendTextToTelegram(
      `👥 角色已生成 (${characters.length} 个)\n\n${charList}\n\n请审阅并确认\n→ POST /api/movies/${movieId}/confirm-characters`
    ).catch(() => {});

    return NextResponse.json({ characters }, { status: 201 });
  } catch (error) {
    console.error('Error generating characters:', error);
    return NextResponse.json(
      { error: '生成角色失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
