import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createQualityReviewJob,
  executeQualityReviewJob,
  normalizeQualityReviewRequest,
} from '@/lib/movie/quality-reviewer';

export const maxDuration = 900;

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const jobs = await prisma.qualityReviewJob.findMany({
      where: { movieId },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        scene: { select: { heading: true, sceneNumber: true } },
        visualAssetJob: { select: { title: true, assetType: true } },
        videoGenerationJob: { select: { title: true, ratio: true } },
      },
    });

    return NextResponse.json({
      jobs: jobs.map((job) => serializeReviewJob(job)),
    });
  } catch (error) {
    console.error('Error fetching quality review jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quality review jobs', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json().catch(() => ({}));
    const reviewRequest = normalizeQualityReviewRequest(body);
    const job = await createQualityReviewJob(movieId, reviewRequest);

    return NextResponse.json({ job: serializeReviewJob(job) }, { status: 201 });
  } catch (error) {
    console.error('Error creating quality review job:', error);
    return NextResponse.json(
      { error: 'Failed to create quality review job', details: error instanceof Error ? error.message : 'Unknown' },
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

    const job = await prisma.qualityReviewJob.findFirst({ where: { id: jobId, movieId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.status === 'running') {
      return NextResponse.json({ job: serializeReviewJob(job) }, { status: 202 });
    }

    executeQualityReviewJob(job.id).catch((error) => {
      console.error(`[QualityReviewJob] ${job.id} failed`, error);
    });

    return NextResponse.json({
      job: serializeReviewJob({ ...job, status: 'running' }),
    }, { status: 202 });
  } catch (error) {
    console.error('Error running quality review job:', error);
    return NextResponse.json(
      { error: 'Failed to run quality review job', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

function serializeReviewJob(job: any) {
  return {
    ...job,
    issues: parseJson(job.issuesJson, []),
    result: parseJson(job.resultJson, null),
  };
}

function parseJson(value: string | null | undefined, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
