import { prisma } from '../prisma';
import { buildCharacterSystemPrompt } from '../movie/prompts';

export async function getNextSceneNumber(movieId: string): Promise<number> {
  const latest = await prisma.scene.findFirst({
    where: { movieId },
    orderBy: { sceneNumber: 'desc' },
  });
  return latest ? latest.sceneNumber + 1 : 1;
}

export async function createScene(
  movieId: string,
  heading: string,
  description: string,
  characterIds: string[],
  maxRounds: number = 10
) {
  if (characterIds.length < 2) {
    throw new Error('A scene needs at least 2 characters');
  }

  // Fetch characters
  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, movieId },
  });

  if (characters.length !== characterIds.length) {
    throw new Error('Some characters were not found');
  }

  const sceneNumber = await getNextSceneNumber(movieId);

  // Build agent data from characters
  const agentsData = characterIds.map((charId, index) => {
    const char = characters.find(c => c.id === charId)!;
    return {
      name: char.name,
      persona: buildCharacterSystemPrompt(char, heading, description),
      order: index + 1,
    };
  });

  // Create RoundTable + Scene + SceneCharacters in a transaction
  return prisma.$transaction(async (tx) => {
    // Create the RoundTable that powers this scene's dialogue
    const roundTable = await tx.roundTable.create({
      data: {
        topic: `[Scene ${sceneNumber}] ${heading}`,
        agentCount: characterIds.length,
        maxRounds,
        status: 'active',
        language: 'en',
        agents: { create: agentsData },
      },
    });

    // Create the Scene
    const scene = await tx.scene.create({
      data: {
        movieId,
        sceneNumber,
        heading: heading.trim(),
        description: description.trim(),
        maxRounds,
        roundTableId: roundTable.id,
      },
    });

    // Create SceneCharacter join records
    await tx.sceneCharacter.createMany({
      data: characterIds.map((charId, index) => ({
        sceneId: scene.id,
        characterId: charId,
        order: index + 1,
      })),
    });

    return scene;
  });
}

export async function getScene(id: string) {
  return prisma.scene.findUnique({
    where: { id },
    include: {
      sceneCharacters: {
        orderBy: { order: 'asc' },
        include: { character: true },
      },
    },
  });
}

export async function getSceneWithDialogue(id: string) {
  return prisma.scene.findUnique({
    where: { id },
    include: {
      movie: true,
      sceneCharacters: {
        orderBy: { order: 'asc' },
        include: { character: true },
      },
      roundTable: {
        include: {
          agents: { orderBy: { order: 'asc' } },
          rounds: {
            orderBy: { roundNumber: 'asc' },
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                include: { agent: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function getScenesByMovie(movieId: string) {
  return prisma.scene.findMany({
    where: { movieId },
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
  });
}

export async function updateSceneFinalizedScript(id: string, script: string) {
  return prisma.scene.update({
    where: { id },
    data: { finalizedScript: script, status: 'finalized' },
  });
}

export async function updateScene(
  id: string,
  data: {
    finalizedScript?: string;
    status?: string;
    contextJson?: string | null;
    settlementSummary?: string | null;
  }
) {
  return prisma.scene.update({
    where: { id },
    data: {
      ...(data.finalizedScript !== undefined && { finalizedScript: data.finalizedScript }),
      ...(data.status != null && { status: data.status }),
      ...(data.contextJson !== undefined && { contextJson: data.contextJson }),
      ...(data.settlementSummary !== undefined && { settlementSummary: data.settlementSummary }),
    },
  });
}

/** Default rounds for agent-based scene dialogue (each round = each character speaks once) */
const SCENE_DEFAULT_MAX_ROUNDS = 12;

/** Create Scene from SceneOutline with agents for turn-by-turn dialogue generation */
export async function createSceneFromOutline(
  movieId: string,
  sceneOutlineId: string,
  outline: { title: string; contentSummary: string; emotionalGoal: string; characterIds: string[] }
) {
  const sceneNumber = await getNextSceneNumber(movieId);

  return prisma.$transaction(async (tx) => {
    const characters = await tx.character.findMany({
      where: { id: { in: outline.characterIds }, movieId },
    });
    const charOrder = new Map(outline.characterIds.map((id, i) => [id, i]));
    const sortedChars = [...characters].sort((a, b) => (charOrder.get(a.id) ?? 99) - (charOrder.get(b.id) ?? 99));

    const agentsData = sortedChars.map((char, index) => ({
      name: char.name,
      persona: buildCharacterSystemPrompt(char, outline.title, outline.contentSummary),
      order: index + 1,
    }));

    const topic = `[Scene ${sceneNumber}] ${outline.title}\n\n${outline.contentSummary}\n\n情感目标: ${outline.emotionalGoal}\n\n请以角色身份表演这场戏，根据对话自然推进。`;

    const roundTable = await tx.roundTable.create({
      data: {
        topic,
        agentCount: agentsData.length,
        maxRounds: SCENE_DEFAULT_MAX_ROUNDS,
        status: 'active',
        language: 'zh',
        agents: { create: agentsData },
      },
    });

    const scene = await tx.scene.create({
      data: {
        movieId,
        sceneNumber,
        heading: outline.title,
        description: outline.contentSummary,
        contentSummary: outline.contentSummary,
        emotionalGoal: outline.emotionalGoal,
        sceneOutlineId,
        status: 'draft',
        roundTableId: roundTable.id,
        maxRounds: SCENE_DEFAULT_MAX_ROUNDS,
      },
    });

    await tx.sceneCharacter.createMany({
      data: outline.characterIds.map((charId, i) => ({
        sceneId: scene.id,
        characterId: charId,
        order: i + 1,
      })),
    });

    return scene;
  });
}

export async function deleteScene(id: string) {
  const scene = await prisma.scene.findUnique({
    where: { id },
    select: { roundTableId: true },
  });

  if (!scene) throw new Error('Scene not found');

  await prisma.$transaction([
    prisma.scene.delete({ where: { id } }),
    prisma.roundTable.delete({ where: { id: scene.roundTableId } }),
  ]);
}
