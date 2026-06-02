import { NextRequest, NextResponse } from 'next/server';
import { updateCharacter, deleteCharacter } from '@/lib/db/characters';

interface RouteParams {
  params: Promise<{ movieId: string; characterId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { characterId } = await params;
    const body = await request.json();
    const character = await updateCharacter(characterId, body);
    return NextResponse.json({ character });
  } catch (error) {
    console.error('Error updating character:', error);
    return NextResponse.json({ error: '更新角色失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { characterId } = await params;
    await deleteCharacter(characterId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting character:', error);
    return NextResponse.json({ error: '删除角色失败' }, { status: 500 });
  }
}
