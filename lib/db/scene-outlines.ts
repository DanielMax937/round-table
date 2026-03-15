import { prisma } from '../prisma';

export async function createSceneOutlines(
  movieId: string,
  items: Array<{ title: string; contentSummary: string; emotionalGoal: string; characterIds: string[] }>
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
      ...(data.characterIdsJson != null && { characterIdsJson: data.characterIdsJson }),
      ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
    },
  });
}
