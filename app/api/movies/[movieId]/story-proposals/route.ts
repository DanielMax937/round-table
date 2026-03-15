import { NextRequest, NextResponse } from 'next/server';
import { getMovie, updateMovie } from '@/lib/db/movies';
import { generateStoryProposals } from '@/lib/movie/story-proposals';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** GET: 获取已生成的故事提案列表 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }
    const proposals = movie.storyProposalsJson
      ? (JSON.parse(movie.storyProposalsJson) as any[])
      : [];
    return NextResponse.json({ proposals });
  } catch (error) {
    console.error('Error fetching story proposals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

/** POST: 根据主题生成 3 个故事提案 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const theme = movie.theme || (await request.json()).theme;
    if (!theme?.trim()) {
      return NextResponse.json(
        { error: 'Theme is required. Set movie.theme or pass { theme } in body.' },
        { status: 400 }
      );
    }

    const proposals = await generateStoryProposals(theme);
    await updateMovie(movieId, {
      storyProposalsJson: JSON.stringify(proposals),
      workflowPhase: 'proposals',
    });

    // Notify user via Telegram
    const { sendTextToTelegram } = await import('@/lib/telegram');
    const msg = `🎬 AI 剧本 - 故事提案已生成\n\n主题: ${theme}\n\n请选择其一确认:\n${proposals
      .map((p: any, i: number) => `${i + 1}. ${p.oneLiner}`)
      .join('\n')}\n\n→ POST /api/movies/${movieId}/confirm-story { proposalIndex: 0|1|2 }`;
    sendTextToTelegram(msg).catch(() => {});

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error('Error generating story proposals:', error);
    return NextResponse.json(
      { error: 'Failed to generate proposals', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
