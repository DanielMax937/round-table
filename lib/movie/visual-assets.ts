import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { chatCompletion } from '@/lib/llm/client';

export type VisualAssetType =
  | 'comic'
  | 'storyboard'
  | 'character_look'
  | 'keyframe'
  | 'environment';

export type VisualStyle =
  | 'animation'
  | 'cg_animation'
  | 'live_action'
  | 'manga'
  | 'ink_storyboard'
  | 'photorealistic'
  | 'concept_art';

export interface VisualAssetRequest {
  assetTypes: VisualAssetType[];
  styles: VisualStyle[];
  sceneIds?: string[];
  characterIds?: string[];
  run?: boolean;
  notes?: string;
}

interface MovieForVisuals {
  id: string;
  title: string;
  theme?: string | null;
  description?: string | null;
  plotSummary?: string | null;
  storyProposalJson?: string | null;
  characters: Array<{
    id: string;
    name: string;
    backstory: string;
    personalityTraits: string;
    surfaceGoal?: string | null;
    deepMotivation?: string | null;
    fatalFlaw?: string | null;
    signatureLanguageStyle?: string | null;
  }>;
  scenes: Array<{
    id: string;
    sceneNumber: number;
    heading: string;
    description: string;
    contentSummary?: string | null;
    emotionalGoal?: string | null;
    finalizedScript?: string | null;
    sceneCharacters: Array<{ character: { id: string; name: string } }>;
  }>;
  sceneOutlines: Array<{
    id: string;
    sortOrder: number;
    title: string;
    contentSummary: string;
    emotionalGoal: string;
    characterIdsJson: string;
  }>;
}

export function normalizeVisualAssetRequest(input: Partial<VisualAssetRequest>): VisualAssetRequest {
  const assetTypes = normalizeList(input.assetTypes, ['storyboard']);
  const styles = normalizeList(input.styles, ['live_action']);
  return {
    assetTypes: assetTypes.filter(isVisualAssetType),
    styles: styles.filter(isVisualStyle),
    sceneIds: normalizeList(input.sceneIds, []),
    characterIds: normalizeList(input.characterIds, []),
    run: Boolean(input.run),
    notes: typeof input.notes === 'string' ? input.notes.trim() : '',
  };
}

export async function createVisualAssetJobs(movieId: string, request: VisualAssetRequest) {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
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
        },
      },
    },
  });

  if (!movie) {
    throw new Error('Movie not found');
  }

  if (!request.assetTypes.length) {
    throw new Error('At least one visual asset type is required');
  }
  if (!request.styles.length) {
    throw new Error('At least one visual style is required');
  }

  const specs = await buildVisualAssetSpecs(movie, request);
  const jobs = [];
  for (const spec of specs) {
    const job = await prisma.visualAssetJob.create({
      data: {
        movieId: movie.id,
        sceneId: spec.sceneId,
        characterId: spec.characterId,
        assetType: spec.assetType,
        stylesJson: JSON.stringify(request.styles),
        title: spec.title,
        prompt: spec.prompt,
        codexPrompt: spec.codexPrompt,
        codexCommand: spec.codexCommand,
        executionCommand: spec.executionCommand,
      },
    });
    jobs.push(job);

    if (request.run) {
      executeVisualAssetJob(job.id).catch((error) => {
        console.error(`[VisualAssetJob] ${job.id} failed`, error);
      });
    }
  }

  return jobs;
}

export async function executeVisualAssetJob(jobId: string): Promise<void> {
  const job = await prisma.visualAssetJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error(`Visual asset job ${jobId} not found`);
  }

  await prisma.visualAssetJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: new Date(),
      error: null,
    },
  });

  const outputDir = path.join(process.cwd(), 'outputs', 'visual-assets', job.id);
  fs.mkdirSync(outputDir, { recursive: true });
  const executablePrompt = buildExecutableCodexPrompt(job.codexPrompt, outputDir);
  const args = buildCodexExecutionArgs(executablePrompt);
  const executionCommand = shellQuoteCommand(['codex', ...args]);
  await prisma.visualAssetJob.update({
    where: { id: jobId },
    data: { executionCommand },
  });

  try {
    const result = await runCommand('codex', args);
    await prisma.visualAssetJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        result: result.slice(-12000),
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.visualAssetJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message.slice(0, 4000) : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function buildVisualAssetSpecs(movie: MovieForVisuals, request: VisualAssetRequest) {
  const sceneTargets = selectScenes(movie, request.sceneIds);
  const characterTargets = selectCharacters(movie, request.characterIds);
  const specs: Array<{
    assetType: VisualAssetType;
    sceneId?: string;
    characterId?: string;
    title: string;
    prompt: string;
    codexPrompt: string;
    codexCommand: string;
    executionCommand: string;
  }> = [];

  for (const assetType of request.assetTypes) {
    if (assetType === 'character_look') {
      for (const character of characterTargets) {
        const prompt = await generateVisualPromptWithLLM({
          movie,
          assetType,
          styles: request.styles,
          notes: request.notes,
          character,
        });
        const codexPrompt = buildCodexImagePrompt('角色定妆照', prompt, request.styles);
        specs.push({
          assetType,
          characterId: character.id,
          title: `${character.name} 定妆照`,
          prompt,
          codexPrompt,
          codexCommand: buildRequestedCodexCommand(codexPrompt),
          executionCommand: shellQuoteCommand(['codex', ...buildCodexExecutionArgs(codexPrompt)]),
        });
      }
      continue;
    }

    for (const scene of sceneTargets) {
      const prompt = await generateVisualPromptWithLLM({
        movie,
        assetType,
        styles: request.styles,
        notes: request.notes,
        scene,
      });
      const title = `${sceneLabel(scene)} ${visualAssetTypeLabel(assetType)}`;
      const codexPrompt = buildCodexImagePrompt(title, prompt, request.styles);
      specs.push({
        assetType,
        sceneId: scene.id,
        title,
        prompt,
        codexPrompt,
        codexCommand: buildRequestedCodexCommand(codexPrompt),
        executionCommand: shellQuoteCommand(['codex', ...buildCodexExecutionArgs(codexPrompt)]),
      });
    }
  }

  return specs;
}

async function generateVisualPromptWithLLM(input: {
  movie: MovieForVisuals;
  assetType: VisualAssetType;
  styles: VisualStyle[];
  notes?: string;
  scene?: MovieForVisuals['scenes'][number];
  character?: MovieForVisuals['characters'][number];
}): Promise<string> {
  const { movie, scene, character } = input;
  const targetLabel = input.assetType === 'character_look'
    ? 'character look-development image'
    : `${visualAssetTypeLabel(input.assetType)} image`;
  const story = parseStoryProposal(movie.storyProposalJson) || movie.plotSummary || movie.description || '';
  const sceneContext = scene
    ? [
        `Scene: ${scene.heading}`,
        `Summary: ${scene.contentSummary || scene.description}`,
        scene.emotionalGoal ? `Emotional goal: ${scene.emotionalGoal}` : '',
        scene.finalizedScript ? `Approved screenplay excerpt:\n${truncate(scene.finalizedScript, 1200)}` : '',
        `Characters in scene: ${scene.sceneCharacters.map((sc) => sc.character.name).join(', ') || 'not specified'}`,
      ].filter(Boolean).join('\n')
    : '';
  const characterContext = character
    ? [
        `Character: ${character.name}`,
        `Backstory: ${character.backstory}`,
        `Personality: ${character.personalityTraits}`,
        character.surfaceGoal ? `Surface goal: ${character.surfaceGoal}` : '',
        character.deepMotivation ? `Deep motivation: ${character.deepMotivation}` : '',
        character.fatalFlaw ? `Fatal flaw: ${character.fatalFlaw}` : '',
        character.signatureLanguageStyle ? `Speech/behavior style: ${character.signatureLanguageStyle}` : '',
      ].filter(Boolean).join('\n')
    : '';

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          'You are a film art director and cinematographer writing image-generation prompts for production use.',
          'Generate the actual image prompt. Do not act as an agent, do not mention tools, and do not explain your reasoning.',
          'The prompt must be specific enough for a director, production designer, costume/makeup, and image model.',
          'Avoid empty AI phrases such as cinematic, epic, high quality, stunning, masterpiece, film-production-grade, ultra realistic, beautiful lighting unless replaced by concrete camera, blocking, props, light source, costume, and spatial direction.',
          'Prefer one controllable shot or board over overloaded compositions. Reduce hand/finger and text-rendering risk.',
          'Output only the final English image prompt.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Movie: ${movie.title}`,
          story ? `Story context: ${truncate(story, 600)}` : '',
          `Requested asset: ${targetLabel}`,
          `Visual styles requested by user: ${input.styles.map(styleLabel).join(' + ')}`,
          sceneContext,
          characterContext,
          input.notes ? `User notes: ${input.notes}` : '',
          '',
          'Prompt requirements:',
          '- Define exact frame/board type, aspect ratio, shot size, camera height, lens feel, and depth.',
          '- Define blocking, eyelines, foreground/midground/background, practical light source, and 2-4 readable props.',
          '- Define character wardrobe/grooming only when relevant.',
          '- If this is a character look board, separate the board zones clearly and keep anatomy/identity consistent.',
          '- If this is a scene keyframe/storyboard/environment/comic page, make it executable and not poster-like.',
          '- Include negative constraints: no subtitles, no watermark, no UI, no random text, no extra props.',
        ].filter(Boolean).join('\n'),
      },
    ],
    { temperature: 0.35, maxTokens: 1600 }
  );

  const prompt = result.trim();
  if (!prompt) {
    throw new Error('LLM returned empty visual prompt');
  }
  return prompt;
}

function buildSceneVisualPrompt(
  movie: MovieForVisuals,
  scene: MovieForVisuals['scenes'][number],
  assetType: VisualAssetType,
  styles: VisualStyle[],
  notes?: string
): string {
  const styleText = styles.map(styleLabel).join(' + ');
  const characters = scene.sceneCharacters.map((sc) => sc.character.name).join(', ') || 'scene characters';
  const sceneText = [
    scene.contentSummary || scene.description,
    scene.emotionalGoal ? `Emotional goal: ${scene.emotionalGoal}` : '',
    scene.finalizedScript ? `Approved screenplay excerpt: ${truncate(scene.finalizedScript, 520)}` : '',
  ].filter(Boolean).join('\n');

  if (assetType === 'comic') {
    return `Create a production comic page based on the movie scene, using concrete staging rather than decorative style words.

MOVIE: ${movie.title}
SCENE: ${scene.heading}
STYLE: ${styleText}
CHARACTERS: ${characters}
STORY CONTENT:
${sceneText}

FORMAT:
A single polished comic page with 4-6 panels, clear panel-to-panel storytelling, expressive acting, readable staging, cinematic composition, and no speech bubbles unless explicitly useful. Use panel variety: establishing shot, medium confrontation, reaction close-up, insert detail, final emotional beat.

VISUAL DIRECTION:
Preserve character consistency, wardrobe logic, emotional continuity, location geography, and clear screen direction. Use concrete props, body language, eye lines, and social distance to show conflict instead of explanatory text.

OUTPUT:
High-detail production comic page, no watermark, no UI, no random text. ${notes || ''}`.trim();
  }

  if (assetType === 'storyboard') {
    return `Create a shot-by-shot storyboard / film previsualization board with executable camera and blocking notes.

MOVIE: ${movie.title}
SCENE: ${scene.heading}
STYLE: ${styleText}
CHARACTERS: ${characters}
SCENE:
${sceneText}

FORMAT:
Horizontal 16:9 storyboard sheet with 6 panels. Each panel must include a panel number, shot size, camera height, lens feel, character blocking, and one concrete action beat. Use: establishing geography, entrance/obstruction, over-the-shoulder conflict, insert prop, reaction close-up, final turning beat.

CAMERA:
Use director-readable shot design: specific foreground obstruction, eyeline direction, screen direction, axis continuity, distance between bodies, and practical light source. Avoid generic “cinematic” beauty; make every panel solve a staging problem for the scene.

OUTPUT:
Production-ready storyboard board for director, cinematographer, editor, and VFX planning. ${notes || ''}`.trim();
  }

  if (assetType === 'environment') {
    return `Create an environment and camera sequence board with readable geography and practical production detail.

MOVIE: ${movie.title}
LOCATION / SCENE: ${scene.heading}
STYLE: ${styleText}
SCENE CONTENT:
${sceneText}

FORMAT:
A 3-panel sequential environment board showing spatial reveal and camera progression through the location. Include a floor-plan-readable sense of entrances/exits, foreground/midground/background layers, practical light sources, working surfaces, prop clusters, and one story-relevant object that can be handled by an actor.

CAMERA:
Frame 1: establishing geography. Frame 2: move closer to the conflict area. Frame 3: land on the detail that carries emotional pressure.

OUTPUT:
Film-production concept art board, high-budget visual development quality, no watermark, no random text. ${notes || ''}`.trim();
  }

  return `Create one acted film still / keyframe for a decisive scene moment. Treat this as a photography setup for a real crew.

MOVIE: ${movie.title}
SCENE: ${scene.heading}
STYLE: ${styleText}
CHARACTERS: ${characters}
SCENE:
${sceneText}

EMOTIONAL CORE:
Show the exact pressure point of the scene through body language, blocking, props, light, and distance between characters. Do not make it generic, poster-like, symmetrical, or “epic”. The image should look like a frame from an acted scene, not concept-art wallpaper.

CAMERA:
Use this exact production specification unless the scene context contradicts it:
- Shot size: medium two-shot or tight over-the-shoulder, whichever makes the power shift clearer.
- Lens feel: 35mm or 50mm natural perspective, shallow but readable depth of field.
- Camera height: actor eye level, slightly favoring the character who is losing control.
- Blocking: define each character's position relative to the desk, doorway, window, and key prop.
- Eyelines: one character avoids direct eye contact; the other watches the object or paper before looking up.
- Foreground: one concrete prop partially cuts the frame, such as a file edge, cup, phone, budget sheet, or food container.
- Lighting: practical office light plus window spill; avoid glossy advertisement lighting.
- Previous second: show the aftermath of one small action, such as a file just slapped down, a photo turned face-down, a cup nearly dropped, or steam rising from food.

OUTPUT:
Single still image, no text, no watermark, no fake UI, no poster layout, no generic dramatic haze. ${notes || ''}`.trim();
}

function buildCharacterLookPrompt(
  movie: MovieForVisuals,
  character: MovieForVisuals['characters'][number],
  styles: VisualStyle[],
  notes?: string
): string {
  return `Create a character look-development board / casting look board with specific costume, makeup, and photography notes.

MOVIE: ${movie.title}
CHARACTER: ${character.name}
STYLE: ${styles.map(styleLabel).join(' + ')}

CHARACTER IDENTITY:
Backstory: ${character.backstory}
Personality: ${character.personalityTraits}
Surface goal / pressure: ${character.surfaceGoal || 'infer from story'}
Deep motivation: ${character.deepMotivation || 'infer from story'}
Fatal flaw: ${character.fatalFlaw || 'infer from story'}
Signature speech / behavior: ${character.signatureLanguageStyle || 'infer from personality'}

BOARD REQUIREMENTS:
Create a clean casting/look board with separate, readable zones: full-body front view, 3/4 view, side silhouette, head close-up, expression study with 4 subtle emotional states, wardrobe/material callouts, key prop, and one in-world portrait. Keep all figures anatomically consistent and avoid crowding the page.

DESIGN RULES:
The character must feel castable and playable, not generic. Define age signal, posture, face structure, hair, skin texture, hands, costume material, wear marks, personal grooming, and one prop with a practical use. If the character has a contradiction, show it visually with a concrete wardrobe or behavior detail instead of symbolic decoration.

OUTPUT:
Film look-development board usable by director, casting, costume, makeup, and image-to-video prompting. No watermark, no random text, no fake UI. ${notes || ''}`.trim();
}

function buildCodexImagePrompt(title: string, imagePrompt: string, styles: VisualStyle[]): string {
  return [
    `使用imagegen生成${title}图片。`,
    `风格: ${styles.map(styleLabel).join('、')}。`,
    '请直接生成图片，不要只返回文字说明。',
    '不要使用海报、宣传图、AI概念图套路；要像真实影视部门会拿去继续工作的剧照、分镜或美术参考。',
    '优先执行具体镜头、调度、光源、道具和人物状态，不要把“电影感、高级感、史诗感”当成画面内容。',
    '图片生成 prompt 如下：',
    imagePrompt,
  ].join('\n\n');
}

function buildExecutableCodexPrompt(codexPrompt: string, outputDir: string): string {
  return [
    codexPrompt,
    `请将最终生成的图片保存到本地目录：${outputDir}`,
    '如果工具返回的是图片附件，请把图片落盘为 PNG 或 JPG 文件。',
    '最后只输出保存后的绝对文件路径，不要输出额外说明。',
  ].join('\n\n');
}

function buildRequestedCodexCommand(codexPrompt: string): string {
  return `codex -p ${JSON.stringify(codexPrompt)}`;
}

function buildCodexExecutionArgs(codexPrompt: string): string[] {
  const configured = process.env.CODEX_IMAGEGEN_COMMAND;
  if (configured?.trim()) {
    return configured.split(/\s+/).concat(codexPrompt);
  }
  return ['exec', '--dangerously-bypass-approvals-and-sandbox', codexPrompt];
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(process.env.VISUAL_ASSET_COMMAND_TIMEOUT_MS || 5 * 60 * 1000);
    const proc = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HF_ENDPOINT: process.env.HF_ENDPOINT || 'https://hf-mirror.com',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGTERM');
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(output || `${command} exited with code ${code}`));
      }
    });
  });
}

function selectScenes(movie: MovieForVisuals, sceneIds?: string[]) {
  const scenes = movie.scenes.length
    ? movie.scenes
    : movie.sceneOutlines.map((outline) => ({
        id: outline.id,
        sceneNumber: outline.sortOrder + 1,
        heading: outline.title,
        description: outline.contentSummary,
        contentSummary: outline.contentSummary,
        emotionalGoal: outline.emotionalGoal,
        finalizedScript: null,
        sceneCharacters: parseCharacterIds(outline.characterIdsJson)
          .map((id) => movie.characters.find((character) => character.id === id))
          .filter((character): character is MovieForVisuals['characters'][number] => Boolean(character))
          .map((character) => ({ character: { id: character.id, name: character.name } })),
      }));
  if (!sceneIds?.length) return scenes.slice(0, 3);
  const wanted = new Set(sceneIds);
  return scenes.filter((scene) => wanted.has(scene.id));
}

function selectCharacters(movie: MovieForVisuals, characterIds?: string[]) {
  if (!characterIds?.length) return movie.characters;
  const wanted = new Set(characterIds);
  return movie.characters.filter((character) => wanted.has(character.id));
}

function parseCharacterIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function parseStoryProposal(value?: string | null): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return [parsed.oneLiner, parsed.coreConflict, parsed.synopsis, parsed.styleReference]
      .filter(Boolean)
      .join(' ');
  } catch {
    return value;
  }
}

function isVisualAssetType(value: string): value is VisualAssetType {
  return ['comic', 'storyboard', 'character_look', 'keyframe', 'environment'].includes(value);
}

function isVisualStyle(value: string): value is VisualStyle {
  return ['animation', 'cg_animation', 'live_action', 'manga', 'ink_storyboard', 'photorealistic', 'concept_art'].includes(value);
}

function normalizeList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return fallback;
}

function visualAssetTypeLabel(type: VisualAssetType): string {
  const labels: Record<VisualAssetType, string> = {
    comic: '漫画页',
    storyboard: '分镜图',
    character_look: '角色定妆照',
    keyframe: '电影关键帧',
    environment: '环境设定图',
  };
  return labels[type];
}

function styleLabel(style: VisualStyle): string {
  const labels: Record<VisualStyle, string> = {
    animation: '动画电影风格',
    cg_animation: 'CG 动画电影风格',
    live_action: '真人电影风格',
    manga: '漫画风格',
    ink_storyboard: '黑白手绘分镜风格',
    photorealistic: '照片级写实风格',
    concept_art: '电影概念设定风格',
  };
  return labels[style];
}

function sceneLabel(scene: { sceneNumber?: number; heading: string }): string {
  return scene.sceneNumber ? `Scene ${scene.sceneNumber}: ${scene.heading}` : scene.heading;
}

function shellQuoteCommand(parts: string[]): string {
  return parts.map((part) => JSON.stringify(part)).join(' ');
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
