import { prisma } from '../prisma';

export interface CreateCharacterData {
  name: string;
  backstory: string;
  personalityTraits: string;
  surfaceGoal?: string;
  deepMotivation?: string;
  fatalFlaw?: string;
  signatureLanguageStyle?: string;
}

export async function createCharacter(
  movieId: string,
  data: CreateCharacterData
) {
  return prisma.character.create({
    data: {
      movieId,
      name: data.name.trim(),
      backstory: data.backstory.trim(),
      personalityTraits: data.personalityTraits.trim(),
      surfaceGoal: data.surfaceGoal?.trim() || null,
      deepMotivation: data.deepMotivation?.trim() || null,
      fatalFlaw: data.fatalFlaw?.trim() || null,
      signatureLanguageStyle: data.signatureLanguageStyle?.trim() || null,
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
  data: {
    name?: string;
    backstory?: string;
    personalityTraits?: string;
    surfaceGoal?: string;
    deepMotivation?: string;
    fatalFlaw?: string;
    signatureLanguageStyle?: string;
    currentStateJson?: string | null;
  }
) {
  return prisma.character.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name.trim() }),
      ...(data.backstory != null && { backstory: data.backstory.trim() }),
      ...(data.personalityTraits != null && { personalityTraits: data.personalityTraits.trim() }),
      ...(data.surfaceGoal !== undefined && { surfaceGoal: data.surfaceGoal?.trim() || null }),
      ...(data.deepMotivation !== undefined && { deepMotivation: data.deepMotivation?.trim() || null }),
      ...(data.fatalFlaw !== undefined && { fatalFlaw: data.fatalFlaw?.trim() || null }),
      ...(data.signatureLanguageStyle !== undefined && { signatureLanguageStyle: data.signatureLanguageStyle?.trim() || null }),
      ...(data.currentStateJson !== undefined && { currentStateJson: data.currentStateJson }),
    },
  });
}

export async function deleteCharacter(id: string) {
  await prisma.character.delete({ where: { id } });
}
