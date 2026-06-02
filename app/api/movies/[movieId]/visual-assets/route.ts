import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createVisualAssetJobs,
  executeVisualAssetJobWithQuality,
  markFailedVisualAssetJobsWithImagesCompleted,
  normalizeVisualAssetRequest,
} from '@/lib/movie/visual-assets';
import { getVisualAssetImageUrls } from '@/lib/movie/asset-files';

export const maxDuration = 600;

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    await markStaleRunningJobsFailed(movieId);
    await markFailedVisualAssetJobsWithImagesCompleted(movieId);
    const jobs = await prisma.visualAssetJob.findMany({
      where: { movieId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        scene: { select: { heading: true, sceneNumber: true } },
        character: { select: { name: true } },
      },
    });

    return NextResponse.json({
      jobs: jobs.map((job) => serializeVisualAssetJob(movieId, job)),
    });
  } catch (error) {
    console.error('Error fetching visual asset jobs:', error);
    return NextResponse.json(
      { error: '获取视觉资产任务失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json().catch(() => ({}));
    const visualRequest = normalizeVisualAssetRequest(body);
    if (visualRequest.run) {
      const activeJob = await prisma.visualAssetJob.findFirst({
        where: { movieId, status: 'running' },
        select: { id: true, title: true },
      });
      if (activeJob) {
        return NextResponse.json(
          { error: `已有视觉资产任务运行中：${activeJob.title}。请等待它完成后再创建并执行新任务。` },
          { status: 409 }
        );
      }
    }
    const jobs = await createVisualAssetJobs(movieId, visualRequest);

    return NextResponse.json({
      jobs: jobs.map((job) => serializeVisualAssetJob(movieId, job)),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating visual asset jobs:', error);
    return NextResponse.json(
      { error: '创建视觉资产任务失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json().catch(() => ({}));
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    if (!jobId) {
      return NextResponse.json({ error: '任务 ID 为必填项' }, { status: 400 });
    }

    const job = await prisma.visualAssetJob.findFirst({
      where: { id: jobId, movieId },
    });
    if (!job) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    if (job.status === 'running') {
      return NextResponse.json({ job: serializeVisualAssetJob(movieId, job) }, { status: 202 });
    }

    const activeJob = await prisma.visualAssetJob.findFirst({
      where: {
        movieId,
        status: 'running',
        id: { not: job.id },
      },
      select: { id: true, title: true },
    });
    if (activeJob) {
      return NextResponse.json(
        { error: `已有视觉资产任务运行中：${activeJob.title}。请等待它完成后再执行下一个。` },
        { status: 409 }
      );
    }

    executeVisualAssetJobWithQuality(job.id).catch((error) => {
      console.error(`[VisualAssetJob] ${job.id} failed`, error);
    });

    return NextResponse.json({
      job: serializeVisualAssetJob(movieId, { ...job, status: 'running' }),
    }, { status: 202 });
  } catch (error) {
    console.error('Error running visual asset job:', error);
    return NextResponse.json(
      { error: '执行视觉资产任务失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

async function markStaleRunningJobsFailed(movieId: string) {
  const staleMs = Number(process.env.VISUAL_ASSET_STALE_RUNNING_MS || 15 * 60 * 1000);
  const staleBefore = new Date(Date.now() - staleMs);
  await prisma.visualAssetJob.updateMany({
    where: {
      movieId,
      status: 'running',
      updatedAt: { lt: staleBefore },
    },
    data: {
      status: 'failed',
      error: '图片生成任务运行超时或执行进程已失联，请重新执行该任务。',
      completedAt: new Date(),
    },
  });
}

function serializeVisualAssetJob(movieId: string, job: any) {
  return {
    ...job,
    styles: JSON.parse(job.stylesJson || '[]'),
    imageUrls: getVisualAssetImageUrls(movieId, job),
  };
}
