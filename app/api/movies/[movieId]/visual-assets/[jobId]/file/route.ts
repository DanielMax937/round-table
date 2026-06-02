import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVisualAssetImagePaths } from '@/lib/movie/asset-files';

interface RouteParams {
  params: Promise<{ movieId: string; jobId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId, jobId } = await params;
    const index = Number(request.nextUrl.searchParams.get('index') || 0);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: '图片索引无效' }, { status: 400 });
    }

    const job = await prisma.visualAssetJob.findFirst({
      where: { id: jobId, movieId },
      select: { id: true, result: true, error: true },
    });
    if (!job) {
      return NextResponse.json({ error: '视觉资产任务不存在' }, { status: 404 });
    }

    const imagePath = getVisualAssetImagePaths(job)[index];
    if (!imagePath) {
      return NextResponse.json({ error: '没有找到该任务生成的图片文件' }, { status: 404 });
    }

    const data = await fs.readFile(imagePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentTypeForPath(imagePath),
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error serving visual asset file:', error);
    return NextResponse.json(
      { error: '读取视觉资产图片失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}
