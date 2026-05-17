import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 600; // 10 min for scene generation (LLM multi-turn)
import { getMovie } from '@/lib/db/movies';
import { getSceneOutlinesByMovie } from '@/lib/db/scene-outlines';
import {
  createSceneExecutionJob,
  getActiveSceneExecutionJob,
  getSceneExecutionJob,
} from '@/lib/db/scene-execution-jobs';
import { executeSceneJobInBackground } from '@/lib/movie/scene-execution-runner';

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await getSceneExecutionJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.movieId !== movieId) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        movieId: job.movieId,
        sceneOutlineId: job.sceneOutlineId,
        sceneId: job.sceneId,
        outlineIndex: job.outlineIndex,
        currentRound: job.currentRound,
        currentAgentName: job.currentAgentName,
        currentPhase: job.currentPhase,
        result: job.result ? JSON.parse(job.result) : null,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching scene execution job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/** POST: Start async scene execution from outline (by outline index 0-based). */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const { outlineIndex } = await request.json().catch(() => ({}));
    const index = typeof outlineIndex === 'number' ? outlineIndex : 0;

    const movie = await getMovie(movieId);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    const outlines = await getSceneOutlinesByMovie(movieId);
    const outline = outlines[index];
    if (!outline) {
      return NextResponse.json({ error: 'Outline not found' }, { status: 404 });
    }

    const existingScene = await prisma.scene.findFirst({
      where: { sceneOutlineId: outline.id },
    });
    if (existingScene) {
      return NextResponse.json(
        { error: 'Scene already created for this outline', sceneId: existingScene.id },
        { status: 400 }
      );
    }

    const activeJob = await getActiveSceneExecutionJob(movieId, outline.id);
    if (activeJob) {
      return NextResponse.json(
        {
          jobId: activeJob.id,
          status: activeJob.status,
          message: 'Scene execution is already running',
        },
        { status: 202 }
      );
    }

    const job = await createSceneExecutionJob({
      movieId,
      sceneOutlineId: outline.id,
      outlineIndex: index,
    });

    executeSceneJobInBackground(job.id).catch((error) => {
      console.error(`Background scene execution job ${job.id} failed:`, error);
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      message: 'Scene execution job created. Poll this endpoint with ?jobId=...',
    }, { status: 202 });
  } catch (error) {
    console.error('Error executing scene:', error);
    return NextResponse.json(
      { error: 'Failed to execute scene', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
