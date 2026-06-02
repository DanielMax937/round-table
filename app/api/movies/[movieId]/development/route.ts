import { NextRequest, NextResponse } from 'next/server';
import { getMovie, updateMovie } from '@/lib/db/movies';
import { getCharactersByMovie } from '@/lib/db/characters';
import {
  generateDevelopmentReport,
  generateStoryBible,
  parseDevelopmentReport,
  parseStoryBible,
} from '@/lib/movie/development';
import type { CharacterProfile, StoryProposal } from '@/lib/movie/types';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export const maxDuration = 300;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: '电影项目不存在' }, { status: 404 });
    }

    return NextResponse.json({
      developmentReport: parseDevelopmentReport(movie.developmentReportJson),
      storyBible: parseStoryBible(movie.storyBibleJson),
    });
  } catch (error) {
    console.error('[Development] Error fetching development material:', error);
    return NextResponse.json(
      { error: '获取开发材料失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: '电影项目不存在' }, { status: 404 });
    }
    if (!movie.storyProposalJson) {
      return NextResponse.json(
        { error: '请先确认故事提案，再生成开发材料。' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force);
    const proposal = JSON.parse(movie.storyProposalJson) as StoryProposal;
    const characters = await getCharactersByMovie(movieId);
    const characterProfiles = characters.map(toCharacterProfile);

    let report = parseDevelopmentReport(movie.developmentReportJson);
    if (!report || force) {
      report = await generateDevelopmentReport({
        movieTitle: movie.title,
        theme: movie.theme,
        proposal,
        characters: characterProfiles,
      });
    }

    let bible = parseStoryBible(movie.storyBibleJson);
    if (!bible || force) {
      bible = await generateStoryBible({
        movieTitle: movie.title,
        proposal,
        report,
        characters: characterProfiles,
      });
    }

    await updateMovie(movieId, {
      developmentReportJson: JSON.stringify(report),
      storyBibleJson: JSON.stringify(bible),
    });

    const { sendTextToTelegram } = await import('@/lib/telegram');
    sendTextToTelegram(
      `📘 开发读本与故事圣经已生成\n\n诊断：${report.quickDiagnosis.grade} - ${report.quickDiagnosis.reason}\n\n下一步：生成/刷新角色与场景大纲。`
    ).catch(() => {});

    return NextResponse.json({ developmentReport: report, storyBible: bible });
  } catch (error) {
    console.error('[Development] Error generating development material:', error);
    return NextResponse.json(
      { error: '生成开发材料失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

function toCharacterProfile(character: {
  name: string;
  backstory: string;
  personalityTraits: string;
  surfaceGoal?: string | null;
  deepMotivation?: string | null;
  fatalFlaw?: string | null;
  signatureLanguageStyle?: string | null;
}): CharacterProfile {
  return {
    name: character.name,
    backstory: character.backstory,
    personalityTraits: character.personalityTraits,
    surfaceGoal: character.surfaceGoal || '',
    deepMotivation: character.deepMotivation || '',
    fatalFlaw: character.fatalFlaw || '',
    signatureLanguageStyle: character.signatureLanguageStyle || '',
  };
}
