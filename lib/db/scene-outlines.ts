import { prisma } from '../prisma';

export async function createSceneOutlines(
  movieId: string,
  items: Array<{
    title: string;
    contentSummary: string;
    emotionalGoal: string;
    characterIds: string[];
    act?: string;
    arcName?: string;
    arcGoal?: string;
    setupPayoff?: string;
    requiredMotif?: string;
  }>
) {
  await prisma.sceneOutline.deleteMany({ where: { movieId } });
  const created = await prisma.$transaction(
    items.map((item, i) =>
      prisma.sceneOutline.create({
        data: {
          movieId,
          sortOrder: i + 1,
          title: item.title,
          contentSummary: item.contentSummary,
          emotionalGoal: item.emotionalGoal,
          act: item.act?.trim() || null,
          arcName: item.arcName?.trim() || null,
          arcGoal: item.arcGoal?.trim() || null,
          setupPayoff: item.setupPayoff?.trim() || null,
          requiredMotif: item.requiredMotif?.trim() || null,
          characterIdsJson: JSON.stringify(item.characterIds),
        },
      })
    )
  );
  return created;
}

export async function getSceneOutlinesByMovie(movieId: string) {
  return prisma.sceneOutline.findMany({
    where: { movieId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getSceneOutline(id: string) {
  return prisma.sceneOutline.findUnique({
    where: { id },
  });
}

export async function deleteSceneOutline(id: string) {
  return prisma.sceneOutline.delete({
    where: { id },
  });
}

export async function updateSceneOutline(
  id: string,
  data: {
    title?: string;
    contentSummary?: string;
    emotionalGoal?: string;
    act?: string | null;
    arcName?: string | null;
    arcGoal?: string | null;
    setupPayoff?: string | null;
    requiredMotif?: string | null;
    characterIdsJson?: string;
    sortOrder?: number;
  }
) {
  return prisma.sceneOutline.update({
    where: { id },
    data: {
      ...(data.title != null && { title: data.title }),
      ...(data.contentSummary != null && { contentSummary: data.contentSummary }),
      ...(data.emotionalGoal != null && { emotionalGoal: data.emotionalGoal }),
      ...(data.act !== undefined && { act: data.act?.trim() || null }),
      ...(data.arcName !== undefined && { arcName: data.arcName?.trim() || null }),
      ...(data.arcGoal !== undefined && { arcGoal: data.arcGoal?.trim() || null }),
      ...(data.setupPayoff !== undefined && { setupPayoff: data.setupPayoff?.trim() || null }),
      ...(data.requiredMotif !== undefined && { requiredMotif: data.requiredMotif?.trim() || null }),
      ...(data.characterIdsJson != null && { characterIdsJson: data.characterIdsJson }),
      ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
    },
  });
}
