import { NextRequest, NextResponse } from 'next/server';
import { getSceneWithDialogue, deleteScene, updateScene } from '@/lib/db/scenes';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, sceneId } = await params;
    const scene = await getSceneWithDialogue(sceneId);

    if (!scene || scene.movieId !== movieId) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    return NextResponse.json({ scene });
  } catch (error) {
    console.error('Error fetching scene:', error);
    return NextResponse.json({ error: 'Failed to fetch scene' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, sceneId } = await params;
    const scene = await getSceneWithDialogue(sceneId);
    if (!scene || scene.movieId !== movieId) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }
    const body = await request.json();
    const data: { finalizedScript?: string; status?: string } = {};
    if (body.finalizedScript != null) data.finalizedScript = body.finalizedScript;
    if (body.status != null) data.status = body.status;
    const updated = await updateScene(sceneId, data);
    return NextResponse.json({ scene: updated });
  } catch (error) {
    console.error('Error updating scene:', error);
    return NextResponse.json(
      { error: 'Failed to update scene' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sceneId } = await params;
    await deleteScene(sceneId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scene:', error);
    return NextResponse.json({ error: 'Failed to delete scene' }, { status: 500 });
  }
}
