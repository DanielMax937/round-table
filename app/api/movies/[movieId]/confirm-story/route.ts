import { NextRequest, NextResponse } from 'next/server';
import { getMovie, updateMovie } from '@/lib/db/movies';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

/** POST: Confirm selected story proposal (index 0-2 or full proposal object) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const body = await request.json();
    let proposalJson: string;

    if (typeof body.proposalIndex === 'number') {
      const all = JSON.parse(movie.storyProposalsJson || '[]');
      const selected = all[body.proposalIndex];
      if (!selected) {
        return NextResponse.json({ error: 'Invalid proposal index' }, { status: 400 });
      }
      proposalJson = JSON.stringify(selected);
    } else if (body.proposal && typeof body.proposal === 'object') {
      proposalJson = JSON.stringify(body.proposal);
    } else {
      return NextResponse.json(
        { error: 'Pass proposalIndex (0-2) or proposal object' },
        { status: 400 }
      );
    }

    await updateMovie(movieId, {
      storyProposalJson: proposalJson,
      workflowPhase: 'characters',
    });

    const proposal = JSON.parse(proposalJson);
    const { sendTextToTelegram } = await import('@/lib/telegram');
    sendTextToTelegram(
      `✅ 故事已确认\n\n${proposal.oneLiner}\n\n下一步: 生成角色\n→ POST /api/movies/${movieId}/characters/generate`
    ).catch(() => {});

    return NextResponse.json({ success: true, storyProposal: proposal });
  } catch (error) {
    console.error('Error confirming story:', error);
    return NextResponse.json(
      { error: 'Failed to confirm story', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
