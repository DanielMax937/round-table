import { chatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
import type { DevelopmentReport, StoryBible } from './types';
import { formatDevelopmentContext, parseDevelopmentReport, parseStoryBible } from './development';

export interface NovelChapterInput {
  movieTitle: string;
  sceneHeading: string;
  sceneDescription: string;
  contentSummary?: string;
  emotionalGoal?: string;
  characters: Array<{
    name: string;
    backstory: string;
    personalityTraits?: string;
    surfaceGoal?: string;
    deepMotivation?: string;
    fatalFlaw?: string;
    signatureLanguageStyle?: string;
  }>;
  screenplay: string;
  developmentReport?: DevelopmentReport | null;
  storyBible?: StoryBible | null;
  scenePlanning?: {
    act?: string | null;
    arcName?: string | null;
    arcGoal?: string | null;
    setupPayoff?: string | null;
    requiredMotif?: string | null;
  } | null;
  previousChapters?: Array<{
    chapterNumber: number;
    title: string;
    content: string;
  }>;
  chapterNumber: number;
}

export interface NovelChapterResult {
  chapterNumber: number;
  title: string;
  content: string;
}

/**
 * Convert a single scene screenplay to prose fiction chapter.
 */
export async function convertScriptToNovel(
  input: NovelChapterInput
): Promise<NovelChapterResult> {
  const prompt = buildNovelConversionPrompt(input);
  const messages: LLMMessage[] = [{ role: 'user', content: prompt }];

  const content = await chatCompletion(messages, {
    temperature: 0.7,
    maxTokens: 8192,
  });

  const cleaned = content.trim();
  const { title, body } = extractTitleAndBody(cleaned, input.chapterNumber);

  return {
    chapterNumber: input.chapterNumber,
    title,
    content: body,
  };
}

function extractTitleAndBody(text: string, chapterNumber: number): { title: string; body: string } {
  // Try to extract title from first line if it looks like a chapter title
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim();

  if (firstLine && (firstLine.startsWith('第') || firstLine.startsWith('Chapter') || firstLine.length < 30)) {
    return {
      title: firstLine,
      body: lines.slice(1).join('\n').trim(),
    };
  }

  return {
    title: `第${chapterNumber}章`,
    body: text,
  };
}

function buildNovelConversionPrompt(input: NovelChapterInput): string {
  let prompt = `你是一位资深网络小说作家，擅长将剧本改编为番茄小说风格的散文体小说。

# 任务
将下面的剧本转换为小说章节。输出必须是纯小说格式，不是剧本格式。

# 电影
${input.movieTitle}

# 当前章节
第${input.chapterNumber}章

# 场景信息
标题：${input.sceneHeading}
描述：${input.sceneDescription}
${input.contentSummary ? `内容摘要：${input.contentSummary}` : ''}
${input.emotionalGoal ? `情感目标：${input.emotionalGoal}` : ''}

${buildNovelDevelopmentContext(input)}

# 角色
`;
  for (const char of input.characters) {
    prompt += `- ${char.name}：${char.personalityTraits || ''}`;
    if (char.signatureLanguageStyle) prompt += `，语言风格：${char.signatureLanguageStyle}`;
    prompt += '\n';
  }

  // Add previous chapters context for continuity
  if (input.previousChapters && input.previousChapters.length > 0) {
    prompt += `\n# 前文回顾（用于保持叙事连贯性）\n`;
    for (const ch of input.previousChapters.slice(-3)) { // Last 3 chapters
      prompt += `## 第${ch.chapterNumber}章 ${ch.title}\n`;
      prompt += `${ch.content.substring(0, 500)}...\n\n`;
    }
  }

  prompt += `
# 原始剧本
${input.screenplay}

# 转换要求

## 格式转换
1. **场景标题**：将 "INT./EXT. LOCATION - TIME" 转换为自然的场景描写或章节标题
2. **对话格式**：将 "角色名\\n（动作提示）\\n台词" 转换为小说对话格式，如：
   - "她说，声音很轻。"
   - "他低声道，手指无意识地敲着桌面。"
   - 使用「」或""包裹对话
3. **动作描写**：将舞台指示转换为生动的散文描写，加入感官细节
4. **内心独白**：适当加入角色的内心活动和情感描写

## 叙事视角
- 自动选择最适合本章的叙事视角（第三人称限制视角或全知视角）
- 如果场景聚焦于某个角色的情感，使用限制视角跟随该角色
- 如果场景涉及多个角色的互动和信息揭示，可以使用全知视角
- 保持视角在同一章节内一致

## 番茄小说标准
1. **章节长度**：2000-3000字中文
2. **章节钩子**：每章结尾要有悬念或情感钩子，吸引读者继续阅读
3. **节奏紧凑**：避免冗长描写，保持情节推进
4. **对话生动**：对话要符合角色性格，有口语感
5. **情感共鸣**：加入能引起读者共鸣的情感描写

## 语言要求
1. 所有内容使用中文，不要夹杂英文
2. 不要出现元叙事词汇：场景、剧情、角色、台词、观众、AI、剧本
3. 不要出现"他/她心想"这种老套表达，用更自然的方式表达内心活动
4. 使用具体细节而非抽象描述（不说"她很伤心"，而说"她的眼眶红了，手指紧紧攥着衣角"）

## 反重复规则（严格遵守）
1. **禁止重复动作描写**：以下每个短语在整章中最多出现一次：
   - "指尖冰凉"、"手指颤抖"、"指节泛白"、"指尖微微发凉"
   - "高跟鞋敲击"、"脚步声在走廊回荡"
   - "深灰色西装"、"一丝不苟"
   - "咖啡凉了"、"冷咖啡"
2. **禁止重复句式**：不要连续两段用相同的句式开头（如连续用"她……"开头）
3. **禁止重复场景**：如果前文已经描写过某个事件（如打开相册、输入密码），后文不要再次详细描写同一事件
4. **角色名一致性**：严格使用剧本中提供的角色名，不要自己发明别名或昵称

## 章节格式
1. 章节标题格式："第X章 标题"（不要用 markdown 的 # 符号）
2. 章节之间用两个空行分隔
3. 段落之间用一个空行分隔

## 输出格式
直接输出小说章节内容。第一行是章节标题（如"第一章 标题"），然后是正文。
不要输出任何解释、说明或markdown格式。`;

  return prompt;
}

/**
 * Convert all scenes of a movie to a novel.
 */
export async function convertMovieToNovel(
  movieId: string,
  options?: {
    onProgress?: (progress: { current: number; total: number; chapter?: NovelChapterResult }) => Promise<void> | void;
  }
): Promise<{ chapters: NovelChapterResult[]; fullNovel: string }> {
  const { prisma } = await import('@/lib/prisma');

  try {
    // Get movie with all data
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      include: {
        characters: true,
        scenes: {
          where: {
            status: { in: ['confirmed', 'finalized'] },
            finalizedScript: { not: null },
          },
          orderBy: { sceneNumber: 'asc' },
          include: {
            sceneOutline: true,
            sceneCharacters: {
              include: { character: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!movie) throw new Error('Movie not found');
    if (movie.scenes.length === 0) throw new Error('No finalized scenes found');

    const chapters: NovelChapterResult[] = [];
    const totalScenes = movie.scenes.length;
    const developmentReport = parseDevelopmentReport(movie.developmentReportJson);
    const storyBible = parseStoryBible(movie.storyBibleJson);

    for (let i = 0; i < totalScenes; i++) {
      const scene = movie.scenes[i];
      const chapterNumber = i + 1;

      // Build character list for this scene
      const sceneCharacters = scene.sceneCharacters.map(sc => ({
        name: sc.character.name,
        backstory: sc.character.backstory,
        personalityTraits: sc.character.personalityTraits,
        surfaceGoal: sc.character.surfaceGoal || undefined,
        deepMotivation: sc.character.deepMotivation || undefined,
        fatalFlaw: sc.character.fatalFlaw || undefined,
        signatureLanguageStyle: sc.character.signatureLanguageStyle || undefined,
      }));

      // Build previous chapters context
      const previousChapters = chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        content: ch.content,
      }));

      const input: NovelChapterInput = {
        movieTitle: movie.title,
        sceneHeading: scene.heading,
        sceneDescription: scene.description,
        contentSummary: scene.contentSummary || undefined,
        emotionalGoal: scene.emotionalGoal || undefined,
        characters: sceneCharacters,
        screenplay: scene.finalizedScript || '',
        developmentReport,
        storyBible,
        scenePlanning: scene.sceneOutline ? {
          act: scene.sceneOutline.act,
          arcName: scene.sceneOutline.arcName,
          arcGoal: scene.sceneOutline.arcGoal,
          setupPayoff: scene.sceneOutline.setupPayoff,
          requiredMotif: scene.sceneOutline.requiredMotif,
        } : null,
        previousChapters,
        chapterNumber,
      };

      const chapter = await convertScriptToNovel(input);
      chapters.push(chapter);

      if (options?.onProgress) {
        await options.onProgress({
          current: chapterNumber,
          total: totalScenes,
          chapter,
        });
      }
    }

    // Assemble full novel
    const fullNovel = assembleNovel(movie.title, chapters);

    return { chapters, fullNovel };
  } catch (error) {
    console.error('[Novel Converter] Error:', error);
    throw error;
  }
}

function buildNovelDevelopmentContext(input: NovelChapterInput): string {
  const scenePlanning = [
    input.scenePlanning?.act ? `幕/阶段：${input.scenePlanning.act}` : null,
    input.scenePlanning?.arcName ? `叙事弧线：${input.scenePlanning.arcName}` : null,
    input.scenePlanning?.arcGoal ? `弧线目标：${input.scenePlanning.arcGoal}` : null,
    input.scenePlanning?.setupPayoff ? `本章埋设/回收：${input.scenePlanning.setupPayoff}` : null,
    input.scenePlanning?.requiredMotif ? `本章必须出现的物件/空间/动作：${input.scenePlanning.requiredMotif}` : null,
  ].filter(Boolean).join('\n');
  const developmentContext = formatDevelopmentContext({
    report: input.developmentReport,
    bible: input.storyBible,
    maxChars: 5000,
  });
  if (!scenePlanning && !developmentContext) return '';
  return [
    '# 开发约束 / 故事圣经',
    scenePlanning,
    developmentContext,
    '要求：小说化时必须保留不可改事实、角色行为规则、物件/空间母题和本章埋设/回收；但不要在正文中解释这些设计。',
  ].filter(Boolean).join('\n\n');
}

function assembleNovel(title: string, chapters: NovelChapterResult[]): string {
  let novel = `${title}\n\n`;

  for (const chapter of chapters) {
    novel += `${chapter.title}\n\n`;
    novel += `${chapter.content}\n\n\n`;
  }

  return novel.trim();
}
