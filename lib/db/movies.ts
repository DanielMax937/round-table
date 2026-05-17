import { prisma } from '../prisma';

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
  return prisma.movie.findUnique({
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
    },
  });
}

export async function getAllMovies() {
  return prisma.movie.findMany({
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
      ...(data.plotSummary !== undefined && { plotSummary: data.plotSummary }),
      ...(data.workflowPhase != null && { workflowPhase: data.workflowPhase }),
    },
  });
}

export async function deleteMovie(id: string) {
  const scenes = await prisma.scene.findMany({
    where: { movieId: id },
    select: { id: true, roundTableId: true },
  });

  // Use interactive transaction for proper ordering:
  // 1. Delete scenes (removes FK to RoundTable)
  // 2. Delete orphaned RoundTables (cascades Agents, Rounds, Messages)
  // 3. Delete movie (cascades Characters)
  await prisma.$transaction(async (tx) => {
    await tx.scene.deleteMany({ where: { movieId: id } });
    for (const s of scenes) {
      await tx.roundTable.delete({ where: { id: s.roundTableId } });
    }
    await tx.movie.delete({ where: { id } });
  });
}
