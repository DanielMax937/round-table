import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createVideoGenerationJobs,
  executeVideoGenerationJob,
  normalizeVideoGenerationRequest,
} from '@/lib/movie/video-assets';

export const maxDuration = 1800;

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const jobs = await prisma.videoGenerationJob.findMany({
      where: { movieId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        scene: { select: { heading: true, sceneNumber: true } },
        visualAssetJob: { select: { title: true, assetType: true } },
      },
    });

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        sourceImagePaths: JSON.parse(job.sourceImagePathsJson || '[]'),
        doubaoInput: JSON.parse(job.doubaoInputJson || '[]'),
      })),
    });
  } catch (error) {
    console.error('Error fetching video generation jobs:', error);
    return NextResponse.json(
      { error: '获取视频生成任务失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json().catch(() => ({}));
    const videoRequest = normalizeVideoGenerationRequest(body);
    if (videoRequest.run) {
      const activeJob = await prisma.videoGenerationJob.findFirst({
        where: { movieId, status: 'running' },
        select: { id: true, title: true },
      });
      if (activeJob) {
        return NextResponse.json(
          { error: `已有视频任务运行中：${activeJob.title}。请等待它完成后再创建并执行新任务。` },
          { status: 409 }
        );
      }
    }
    const jobs = await createVideoGenerationJobs(movieId, videoRequest);

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        sourceImagePaths: JSON.parse(job.sourceImagePathsJson || '[]'),
        doubaoInput: JSON.parse(job.doubaoInputJson || '[]'),
      })),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating video generation jobs:', error);
    return NextResponse.json(
      { error: '创建视频生成任务失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json().catch(() => ({}));
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    const profileIds = typeof body.profileIds === 'string' && body.profileIds.trim() ? body.profileIds.trim() : '1';
    if (!jobId) {
      return NextResponse.json({ error: '任务 ID 为必填项' }, { status: 400 });
    }

    const job = await prisma.videoGenerationJob.findFirst({
      where: { id: jobId, movieId },
    });
    if (!job) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    if (job.status === 'running') {
      return NextResponse.json({ job }, { status: 202 });
    }

    const activeJob = await prisma.videoGenerationJob.findFirst({
      where: {
        movieId,
        status: 'running',
        id: { not: job.id },
      },
      select: { id: true, title: true },
    });
    if (activeJob) {
      return NextResponse.json(
        { error: `已有视频任务运行中：${activeJob.title}。请等待它完成后再执行下一个。` },
        { status: 409 }
      );
    }

    executeVideoGenerationJob(job.id, profileIds).catch((error) => {
      console.error(`[VideoGenerationJob] ${job.id} failed`, error);
    });

    return NextResponse.json({
      job: {
        ...job,
        status: 'running',
        sourceImagePaths: JSON.parse(job.sourceImagePathsJson || '[]'),
        doubaoInput: JSON.parse(job.doubaoInputJson || '[]'),
      },
    }, { status: 202 });
  } catch (error) {
    console.error('Error running video generation job:', error);
    return NextResponse.json(
      { error: '执行视频生成任务失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
