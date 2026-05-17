import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createVisualAssetJobs,
  executeVisualAssetJob,
  normalizeVisualAssetRequest,
} from '@/lib/movie/visual-assets';

export const maxDuration = 600;

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
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
      jobs: jobs.map((job) => ({
        ...job,
        styles: JSON.parse(job.stylesJson || '[]'),
      })),
    });
  } catch (error) {
    console.error('Error fetching visual asset jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visual asset jobs', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json().catch(() => ({}));
    const visualRequest = normalizeVisualAssetRequest(body);
    const jobs = await createVisualAssetJobs(movieId, visualRequest);

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        styles: JSON.parse(job.stylesJson || '[]'),
      })),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating visual asset jobs:', error);
    return NextResponse.json(
      { error: 'Failed to create visual asset jobs', details: error instanceof Error ? error.message : 'Unknown' },
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
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await prisma.visualAssetJob.findFirst({
      where: { id: jobId, movieId },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.status === 'running') {
      return NextResponse.json({ job }, { status: 202 });
    }

    executeVisualAssetJob(job.id).catch((error) => {
      console.error(`[VisualAssetJob] ${job.id} failed`, error);
    });

    return NextResponse.json({
      job: {
        ...job,
        status: 'running',
        styles: JSON.parse(job.stylesJson || '[]'),
      },
    }, { status: 202 });
  } catch (error) {
    console.error('Error running visual asset job:', error);
    return NextResponse.json(
      { error: 'Failed to run visual asset job', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
