import { prisma } from '@/lib/prisma';

export interface CreateNovelJobData {
  movieId: string;
}

export async function createNovelJob(data: CreateNovelJobData) {
  return prisma.novelConversionJob.create({
    data: {
      movieId: data.movieId,
      status: 'pending',
    },
  });
}

export async function getNovelJob(id: string) {
  return prisma.novelConversionJob.findUnique({
    where: { id },
    include: { movie: true },
  });
}

export async function getNovelJobsByMovie(movieId: string) {
  return prisma.novelConversionJob.findMany({
    where: { movieId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateNovelJob(
  id: string,
  data: {
    status?: string;
    currentChapter?: number;
    totalChapters?: number;
    chaptersJson?: string;
    result?: string;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }
) {
  return prisma.novelConversionJob.update({
    where: { id },
    data,
  });
}

export async function deleteNovelJob(id: string) {
  return prisma.novelConversionJob.delete({
    where: { id },
  });
}
