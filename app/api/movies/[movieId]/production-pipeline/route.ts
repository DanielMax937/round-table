import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  normalizeProductionPipelineRequest,
  runProductionPipeline,
} from '@/lib/movie/production-pipeline';

export const maxDuration = 1800;

interface RouteParams {
  params: Promise<{ movieId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const runs = await prisma.productionPipelineRun.findMany({
      where: { movieId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return NextResponse.json({ runs: runs.map(serializeRun) });
  } catch (error) {
    console.error('Error fetching production pipeline runs:', error);
    return NextResponse.json(
      { error: '获取产制流水线记录失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { movieId } = await params;
    const body = await request.json().catch(() => ({}));
    const pipelineRequest = normalizeProductionPipelineRequest(body);
    const run = await runProductionPipeline(movieId, pipelineRequest);
    return NextResponse.json({ run: serializeRun(run) }, { status: 201 });
  } catch (error) {
    console.error('Error running production pipeline:', error);
    return NextResponse.json(
      { error: '运行产制流水线失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

function serializeRun(run: any) {
  return {
    ...run,
    sceneIds: parseJson(run.sceneIdsJson, []),
    options: parseJson(run.optionsJson, {}),
    result: parseJson(run.resultJson, null),
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
