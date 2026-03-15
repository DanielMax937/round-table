import { NextRequest, NextResponse } from 'next/server';
import { getSceneOutline, updateSceneOutline, deleteSceneOutline } from '@/lib/db/scene-outlines';

interface RouteParams {
  params: Promise<{ movieId: string; outlineId: string }>;
}

/** GET: 获取单个大纲项 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, outlineId } = await params;
    const outline = await getSceneOutline(outlineId);
    if (!outline || outline.movieId !== movieId) {
      return NextResponse.json({ error: 'Outline not found' }, { status: 404 });
    }
    return NextResponse.json({
      outline: {
        ...outline,
        characterIds: JSON.parse(outline.characterIdsJson || '[]'),
      },
    });
  } catch (error) {
    console.error('Error fetching outline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outline' },
      { status: 500 }
    );
  }
}

/** PATCH: 更新大纲项（用户审阅微调） */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, outlineId } = await params;
    const outline = await getSceneOutline(outlineId);
    if (!outline || outline.movieId !== movieId) {
      return NextResponse.json({ error: 'Outline not found' }, { status: 404 });
    }
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title != null) data.title = body.title;
    if (body.contentSummary != null) data.contentSummary = body.contentSummary;
    if (body.emotionalGoal != null) data.emotionalGoal = body.emotionalGoal;
    if (body.characterIds != null) data.characterIdsJson = JSON.stringify(body.characterIds);
    if (body.sortOrder != null) data.sortOrder = body.sortOrder;

    const updated = await updateSceneOutline(outlineId, data as any);
    return NextResponse.json({
      outline: {
        ...updated,
        characterIds: JSON.parse(updated.characterIdsJson || '[]'),
      },
    });
  } catch (error) {
    console.error('Error updating outline:', error);
    return NextResponse.json(
      { error: 'Failed to update outline' },
      { status: 500 }
    );
  }
}

/** DELETE: 删除大纲项 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, outlineId } = await params;
    const outline = await getSceneOutline(outlineId);
    if (!outline || outline.movieId !== movieId) {
      return NextResponse.json({ error: 'Outline not found' }, { status: 404 });
    }
    await deleteSceneOutline(outlineId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting outline:', error);
    return NextResponse.json(
      { error: 'Failed to delete outline' },
      { status: 500 }
    );
  }
}
