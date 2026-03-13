import { NextRequest, NextResponse } from 'next/server';
import { getSceneWithDialogue, deleteScene } from '@/lib/db/scenes';

interface RouteParams {
  params: Promise<{ movieId: string; sceneId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sceneId } = await params;
    const scene = await getSceneWithDialogue(sceneId);

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    return NextResponse.json({ scene });
  } catch (error) {
    console.error('Error fetching scene:', error);
    return NextResponse.json({ error: 'Failed to fetch scene' }, { status: 500 });
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
