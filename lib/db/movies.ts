import { prisma } from '../prisma';

export async function createMovie(title: string, description?: string) {
  return prisma.movie.create({
    data: { title: title.trim(), description: description?.trim() || null },
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

export async function updateMovie(id: string, data: { title?: string; description?: string; status?: string }) {
  return prisma.movie.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.status && { status: data.status }),
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
