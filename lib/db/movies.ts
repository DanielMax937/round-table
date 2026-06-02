import { prisma } from '../prisma';
import { getVisualAssetImageUrls } from '@/lib/movie/asset-files';
import { markFailedVisualAssetJobsWithImagesCompleted } from '@/lib/movie/visual-assets';

export interface CreateMovieData {
  title: string;
  description?: string;
  theme?: string;
}

export async function createMovie(data: CreateMovieData) {
  return prisma.movie.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      theme: data.theme?.trim() || null,
      workflowPhase: data.theme ? 'proposals' : 'theme',
    },
  });
}

export async function getMovie(id: string) {
  return prisma.movie.findUnique({ where: { id } });
}

export async function getMovieWithDetails(id: string) {
  await markFailedVisualAssetJobsWithImagesCompleted(id);
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: {
      characters: { orderBy: { createdAt: 'asc' } },
      sceneOutlines: { orderBy: { sortOrder: 'asc' } },
      scenes: {
        orderBy: { sceneNumber: 'asc' },
        include: {
          sceneCharacters: {
            orderBy: { order: 'asc' },
            include: { character: true },
          },
          roundTable: {
            include: { _count: { select: { rounds: true } } },
          },
        },
      },
      sceneExecutionJobs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      visualAssetJobs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          scene: { select: { heading: true, sceneNumber: true } },
          character: { select: { name: true } },
        },
      },
      videoGenerationJobs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          scene: { select: { heading: true, sceneNumber: true } },
          visualAssetJob: { select: { title: true, assetType: true } },
        },
      },
      qualityReviewJobs: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          scene: { select: { heading: true, sceneNumber: true } },
          visualAssetJob: { select: { title: true, assetType: true } },
          videoGenerationJob: { select: { title: true, ratio: true } },
        },
      },
      productionPipelineRuns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      novelConversionJobs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!movie) return null;
  return {
    ...movie,
    visualAssetJobs: movie.visualAssetJobs.map((job) => ({
      ...job,
      imageUrls: getVisualAssetImageUrls(id, job),
    })),
  };
}

export async function getAllMovies() {
  return prisma.movie.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { characters: true, scenes: true } },
    },
  });
}

export async function updateMovie(
  id: string,
  data: {
    title?: string;
    description?: string;
    status?: string;
    theme?: string;
    storyProposalJson?: string;
    storyProposalsJson?: string;
    developmentReportJson?: string | null;
    storyBibleJson?: string | null;
    plotSummary?: string;
    workflowPhase?: string;
  }
) {
  return prisma.movie.update({
    where: { id },
    data: {
      ...(data.title != null && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.status != null && { status: data.status }),
      ...(data.theme !== undefined && { theme: data.theme?.trim() || null }),
      ...(data.storyProposalJson !== undefined && { storyProposalJson: data.storyProposalJson }),
      ...(data.storyProposalsJson !== undefined && { storyProposalsJson: data.storyProposalsJson }),
      ...(data.developmentReportJson !== undefined && { developmentReportJson: data.developmentReportJson }),
      ...(data.storyBibleJson !== undefined && { storyBibleJson: data.storyBibleJson }),
      ...(data.plotSummary !== undefined && { plotSummary: data.plotSummary }),
      ...(data.workflowPhase != null && { workflowPhase: data.workflowPhase }),
    },
  });
}

export async function deleteMovie(id: string) {
  return prisma.movie.update({
    where: { id },
    data: { status: 'archived' },
  });
}
