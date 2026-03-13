import { prisma } from '../prisma';

export async function createCharacter(
  movieId: string,
  name: string,
  backstory: string,
  personalityTraits: string
) {
  return prisma.character.create({
    data: {
      movieId,
      name: name.trim(),
      backstory: backstory.trim(),
      personalityTraits: personalityTraits.trim(),
    },
  });
}

export async function getCharacter(id: string) {
  return prisma.character.findUnique({ where: { id } });
}

export async function getCharactersByMovie(movieId: string) {
  return prisma.character.findMany({
    where: { movieId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateCharacter(
  id: string,
  data: { name?: string; backstory?: string; personalityTraits?: string }
) {
  return prisma.character.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.backstory && { backstory: data.backstory.trim() }),
      ...(data.personalityTraits && { personalityTraits: data.personalityTraits.trim() }),
    },
  });
}

export async function deleteCharacter(id: string) {
  await prisma.character.delete({ where: { id } });
}
