#!/usr/bin/env tsx
/**
 * Download a public Higgsfield project (prompts + folder tree) via their API.
 *
 * Example:
 *   npx tsx scripts/download-higgsfield-project.ts higgsfield.studio hell-grind
 *   npx tsx scripts/download-higgsfield-project.ts higgsfield.studio hell-grind --refresh --concurrency 8
 *   npx tsx scripts/download-higgsfield-project.ts higgsfield.studio hell-grind --concurrency 8 --download-references
 */

import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  access,
} from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const API_BASE = "https://fnf-api-gw.higgsfield.ai/fnf";
const DEFAULT_HEADERS = {
  Accept: "application/json",
  Origin: "https://higgsfield.ai",
  Referer: "https://higgsfield.ai/",
  "User-Agent":
    "round-table-higgsfield-downloader/1.0 (+https://github.com/local)",
};

type Json = Record<string, unknown>;

type FolderRow = {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  count: number;
  subfolders_count: number;
  is_root: boolean;
};

type ProgressState = {
  username: string;
  slug: string;
  snapshotFolderId: string;
  folderIndex: number;
  completedFolderIds?: string[];
  jobsWritten: number;
  updatedAt: string;
};

function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  let maxJobs = 0;
  let outDir = "";
  let delayMs = 0;
  let concurrency = 1;
  let downloadReferences = false;
  let refresh = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--max-jobs") {
      maxJobs = Number(argv[++i] || 0);
    } else if (arg === "--out") {
      outDir = argv[++i] || "";
    } else if (arg === "--delay-ms") {
      delayMs = Number(argv[++i] || 0);
    } else if (arg === "--concurrency") {
      concurrency = Number(argv[++i] || 1);
    } else if (arg === "--download-references") {
      downloadReferences = true;
    } else if (arg === "--refresh") {
      refresh = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  const [username, slug] = positionals;
  if (!username || !slug) {
    throw new Error(
      "Usage: tsx scripts/download-higgsfield-project.ts <username> <slug> [--max-jobs N] [--out dir] [--delay-ms N] [--concurrency N] [--refresh] [--download-references]"
    );
  }

  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error("--concurrency must be an integer between 1 and 32");
  }

  return {
    username,
    slug,
    maxJobs,
    outDir,
    delayMs,
    concurrency,
    downloadReferences,
    refresh,
  };
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function apiGet(pathname: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    if (response.status === 429 || response.status >= 500) {
      const wait = attempt * 1500;
      console.warn(`  retry ${attempt} after ${response.status}, wait ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API ${response.status} ${pathname}: ${body.slice(0, 240)}`);
    }
    return response.json();
  }

  throw new Error(`API failed after retries: ${pathname}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paginate(
  pathname: string,
  {
    limit = 50,
    delayMs = 0,
    onPage,
  }: {
    limit?: number;
    delayMs?: number;
    onPage?: (batch: unknown[], totalSoFar: number) => Promise<boolean | void> | boolean | void;
  } = {}
) {
  const items: unknown[] = [];
  let cursor: string | number | undefined;

  for (;;) {
    const params: Record<string, string | number> = { limit };
    if (cursor != null) params.cursor = cursor;
    const data = (await apiGet(pathname, params)) as {
      items?: unknown[];
      cursor?: string | number | null;
    };
    const batch = Array.isArray(data.items) ? data.items : [];
    items.push(...batch);
    const stop = await onPage?.(batch, items.length);
    if (stop) break;
    if (!data.cursor || batch.length === 0) break;
    cursor = data.cursor;
    if (delayMs) await sleep(delayMs);
  }

  return items;
}

function normalizeFolder(raw: Json, fallbackParent: string | null = null): FolderRow {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    path: String(raw.path ?? `/${raw.id}/`),
    parent_id: (raw.parent_id as string | null) ?? fallbackParent,
    count: Number(raw.count ?? 0),
    subfolders_count: Number(raw.subfolders_count ?? 0),
    is_root: Boolean(raw.is_root),
  };
}

function normalizeJob(item: Json, folder: FolderRow) {
  const job = (item.type === "job" ? item.job : item.job || item) as Json | undefined;
  if (!job?.id) return null;
  const params = (job.params || {}) as Json;
  const results = (job.results || {}) as Json;
  const media =
    (results.raw as Json | undefined) ||
    (results.min as Json | undefined) ||
    (results.h264 as Json | undefined) ||
    null;

  return {
    id: String(job.id),
    job_set_id: job.job_set_id ?? null,
    job_set_type: job.job_set_type ?? null,
    status: job.status ?? null,
    created_at: job.created_at ?? null,
    folder_id: folder.id,
    folder_name: folder.name,
    folder_path: folder.path,
    prompt: params.prompt ?? null,
    params: {
      model: params.model,
      mode: params.mode,
      duration: params.duration,
      width: params.width,
      height: params.height,
      resolution: params.resolution,
      aspect_ratio: params.aspect_ratio,
      generate_audio: params.generate_audio,
      prompt_language: params.prompt_language,
      genre: params.genre,
      multi_shots: params.multi_shots,
      multi_shot_mode: params.multi_shot_mode,
      multi_prompt: params.multi_prompt,
      bitrate_mode: params.bitrate_mode,
      speedramp: params.speedramp,
      medias: params.medias ?? [],
      reference_elements: Array.isArray(params.reference_elements)
        ? (params.reference_elements as Json[]).map((el) => ({
            id: el.id,
            name: el.name,
            medias: el.medias ?? [],
          }))
        : [],
    },
    media_url: media?.url ?? null,
    thumbnail_url: media?.thumbnail_url ?? null,
    media_type: media?.type ?? null,
  };
}

type ReferenceUsage = {
  id: string | null;
  url: string;
  type: string | null;
  name: string | null;
};

function extractReferenceUsages(job: Json): ReferenceUsage[] {
  const params = (job.params || {}) as Json;
  const usages: ReferenceUsage[] = [];

  for (const raw of (params.medias as Json[] | undefined) || []) {
    const media = ((raw.data as Json | undefined) || raw) as Json;
    if (!media.url) continue;
    usages.push({
      id: media.id ? String(media.id) : null,
      url: String(media.url),
      type: media.type ? String(media.type) : null,
      name: null,
    });
  }

  for (const rawElement of
    (params.reference_elements as Json[] | undefined) || []) {
    const name = rawElement.name ? String(rawElement.name) : null;
    for (const media of (rawElement.medias as Json[] | undefined) || []) {
      if (!media.url) continue;
      usages.push({
        id: media.id ? String(media.id) : null,
        url: String(media.url),
        type: media.type ? String(media.type) : null,
        name,
      });
    }
  }

  return usages;
}

function referenceFileName(reference: ReferenceUsage) {
  const pathname = new URL(reference.url).pathname;
  const extension = path.extname(pathname).toLowerCase() || ".bin";
  const id = (reference.id || "reference").replace(/[^a-zA-Z0-9_-]/g, "_");
  const digest = createHash("sha256").update(reference.url).digest("hex").slice(0, 10);
  return `${id}__${digest}${extension}`;
}

async function downloadReferenceImages(
  references: Array<ReferenceUsage & { local_path?: string }>,
  targetDir: string,
  concurrency: number
) {
  const imagesDir = path.join(targetDir, "reference-media");
  await mkdir(imagesDir, { recursive: true });
  let next = 0;
  let downloaded = 0;

  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= references.length) return;
      const reference = references[index];
      const fileName = referenceFileName(reference);
      const filePath = path.join(imagesDir, fileName);
      const partialPath = `${filePath}.part`;
      const localPath = path.posix.join("reference-media", fileName);
      if (await exists(filePath)) {
        reference.local_path = localPath;
        continue;
      }

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          await execFileAsync(
            "curl",
            [
              "-fsSL",
              "--connect-timeout",
              "20",
              "--max-time",
              "180",
              "--retry",
              "3",
              "--retry-all-errors",
              "--continue-at",
              "-",
              "-H",
              `Referer: ${DEFAULT_HEADERS.Referer}`,
              "-o",
              partialPath,
              reference.url,
            ],
            { maxBuffer: 1024 * 1024 }
          );
          await rename(partialPath, filePath);
          reference.local_path = localPath;
          downloaded += 1;
          if (downloaded % 25 === 0) {
            process.stdout.write(
              `\rreference images: ${downloaded}/${references.length}   `
            );
          }
          break;
        } catch (error) {
          if (attempt === 5) {
            console.warn(`\nfailed reference ${reference.url}: ${error}`);
          } else {
            await sleep(attempt * 1000);
          }
        }
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, references.length)) },
      () => worker()
    )
  );
  process.stdout.write("\n");
}

async function attachExistingReferenceFiles(
  references: Array<ReferenceUsage & { local_path?: string }>,
  targetDir: string
) {
  await Promise.all(
    references.map(async (reference) => {
      const fileName = referenceFileName(reference);
      const filePath = path.join(targetDir, "reference-media", fileName);
      if (await exists(filePath)) {
        reference.local_path = path.posix.join("reference-media", fileName);
      }
    })
  );
}

async function buildIndexes(
  targetDir: string,
  jobsPath: string,
  folders: FolderRow[],
  publication: Json,
  completedFolderIds: Set<string>,
  downloadReferences: boolean,
  concurrency: number
) {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const ancestorCache = new Map<string, FolderRow[]>();
  const ancestorsFor = (folderId: string) => {
    const cached = ancestorCache.get(folderId);
    if (cached) return cached;
    const ancestors: FolderRow[] = [];
    const visited = new Set<string>();
    let current = folderById.get(folderId);
    while (current && !visited.has(current.id)) {
      ancestors.push(current);
      visited.add(current.id);
      current = current.parent_id ? folderById.get(current.parent_id) : undefined;
    }
    ancestorCache.set(folderId, ancestors);
    return ancestors;
  };

  const folderStats = new Map(
    folders.map((folder) => [
      folder.id,
      {
        folder_id: folder.id,
        name: folder.name,
        path: folder.path,
        parent_id: folder.parent_id,
        expected_items: folder.count,
        is_scene: /(^|\b)scene\b/i.test(folder.name),
        direct_jobs: 0,
        subtree_jobs: 0,
        assigned_shots: 0,
        direct_prompts: 0,
        subtree_prompts: 0,
        direct_jobs_with_references: 0,
        subtree_jobs_with_references: 0,
        direct_reference_usages: 0,
        subtree_reference_usages: 0,
        reference_urls: new Set<string>(),
      },
    ])
  );
  const references = new Map<
    string,
    ReferenceUsage & {
      usage_count: number;
      names: Set<string>;
      folder_ids: Set<string>;
      local_path?: string;
    }
  >();
  let jobs = 0;
  let prompts = 0;
  let jobsWithReferences = 0;
  let referenceUsages = 0;
  let shotsAssignedToScenes = 0;

  const shotsPath = path.join(targetDir, "scene-shots.jsonl");
  const shotsStream = createWriteStream(shotsPath, {
    flags: "w",
    encoding: "utf8",
  });

  const input = createInterface({
    input: createReadStream(jobsPath),
    crlfDelay: Infinity,
  });
  for await (const line of input) {
    if (!line.trim()) continue;
    const job = JSON.parse(line) as Json;
    const folderId = String(job.folder_id || "");
    const directFolder = folderStats.get(folderId);
    const ancestors = ancestorsFor(folderId);
    const nearestScene = ancestors.find(
      (folder) => folderStats.get(folder.id)?.is_scene
    );
    const usages = extractReferenceUsages(job);
    jobs += 1;
    if (job.prompt) prompts += 1;
    if (usages.length) jobsWithReferences += 1;
    referenceUsages += usages.length;
    if (directFolder) {
      directFolder.direct_jobs += 1;
      if (job.prompt) directFolder.direct_prompts += 1;
      if (usages.length) directFolder.direct_jobs_with_references += 1;
      directFolder.direct_reference_usages += usages.length;
    }
    for (const ancestor of ancestors) {
      const stat = folderStats.get(ancestor.id);
      if (!stat) continue;
      stat.subtree_jobs += 1;
      if (job.prompt) stat.subtree_prompts += 1;
      if (usages.length) stat.subtree_jobs_with_references += 1;
      stat.subtree_reference_usages += usages.length;
      for (const usage of usages) stat.reference_urls.add(usage.url);
    }
    if (nearestScene) {
      const scene = folderStats.get(nearestScene.id);
      if (scene) scene.assigned_shots += 1;
      shotsAssignedToScenes += 1;
    }

    const shotRow = {
      id: job.id,
      scene_id: nearestScene?.id ?? null,
      scene_name: nearestScene?.name ?? null,
      scene_path: nearestScene?.path ?? null,
      folder_id: job.folder_id ?? null,
      folder_name: job.folder_name ?? null,
      folder_path: job.folder_path ?? null,
      created_at: job.created_at ?? null,
      model: (job.params as Json | undefined)?.model ?? null,
      prompt: job.prompt ?? null,
      reference_media: usages,
      output_url: job.media_url ?? null,
      output_thumbnail_url: job.thumbnail_url ?? null,
      output_type: job.media_type ?? null,
    };
    if (!shotsStream.write(`${JSON.stringify(shotRow)}\n`)) {
      await once(shotsStream, "drain");
    }

    for (const usage of usages) {
      const current = references.get(usage.url) || {
        ...usage,
        usage_count: 0,
        names: new Set<string>(),
        folder_ids: new Set<string>(),
      };
      current.usage_count += 1;
      if (usage.name) current.names.add(usage.name);
      if (folderId) current.folder_ids.add(folderId);
      references.set(usage.url, current);
    }
  }
  shotsStream.end();
  await finished(shotsStream);

  const referenceRows = [...references.values()]
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((reference) => ({
      id: reference.id,
      url: reference.url,
      type: reference.type,
      names: [...reference.names].sort(),
      folder_ids: [...reference.folder_ids].sort(),
      usage_count: reference.usage_count,
      local_path: reference.local_path,
    }));

  await attachExistingReferenceFiles(referenceRows, targetDir);
  if (downloadReferences) {
    await downloadReferenceImages(referenceRows, targetDir, concurrency);
  }

  const sceneRows = [...folderStats.values()]
    .filter((scene) => scene.is_scene)
    .map((scene) => {
      const descendantFolderIds = folders
        .filter((folder) =>
          ancestorsFor(folder.id).some((ancestor) => ancestor.id === scene.folder_id)
        )
        .map((folder) => folder.id);
      const crawlComplete = descendantFolderIds.every((folderId) =>
        completedFolderIds.has(folderId)
      );
      return {
        folder_id: scene.folder_id,
        name: scene.name,
        path: scene.path,
        parent_id: scene.parent_id,
        reported_items: scene.expected_items,
        direct_jobs: scene.direct_jobs,
        subtree_jobs: scene.subtree_jobs,
        assigned_shots: scene.assigned_shots,
        subtree_prompts: scene.subtree_prompts,
        subtree_jobs_with_references: scene.subtree_jobs_with_references,
        subtree_reference_usages: scene.subtree_reference_usages,
        reference_urls: [...scene.reference_urls].sort(),
        descendant_folder_ids: descendantFolderIds,
        reported_count_delta: scene.subtree_jobs - scene.expected_items,
        crawl_complete: crawlComplete,
      };
    });
  const rootReportedItems =
    folders.find((folder) => folder.is_root)?.count ?? null;
  const publicationGenerations = Number(
    ((publication.stats as Json | undefined)?.generations_count as number | undefined) ??
      0
  );
  const crawlComplete = completedFolderIds.size === folders.length;
  const downloadedReferenceMedia = referenceRows.filter(
    (reference) => reference.local_path
  ).length;
  const stats = {
    generated_at: new Date().toISOString(),
    root_reported_items: rootReportedItems,
    publication_generations: publicationGenerations || null,
    unique_jobs: jobs,
    prompts,
    jobs_with_references: jobsWithReferences,
    reference_usages: referenceUsages,
    unique_reference_media: referenceRows.length,
    downloaded_reference_media: downloadedReferenceMedia,
    scene_folders: sceneRows.length,
    shots_assigned_to_scenes: shotsAssignedToScenes,
    shots_without_scene: jobs - shotsAssignedToScenes,
    folders: folders.length,
    completed_folders: completedFolderIds.size,
    crawl_complete: crawlComplete,
    root_reported_item_gap:
      rootReportedItems == null ? null : rootReportedItems - jobs,
    publication_generation_gap:
      publicationGenerations > 0 ? publicationGenerations - jobs : null,
  };

  await writeFile(
    path.join(targetDir, "scene-index.json"),
    JSON.stringify(sceneRows, null, 2)
  );
  await writeFile(
    path.join(targetDir, "references.json"),
    JSON.stringify(referenceRows, null, 2)
  );
  await writeFile(
    path.join(targetDir, "stats.json"),
    JSON.stringify(stats, null, 2)
  );
  return stats;
}

async function walkFolders(rootFolderId: string, delayMs: number) {
  const root = (await apiGet(`/folders/${encodeURIComponent(rootFolderId)}`)) as Json;
  const folders: FolderRow[] = [normalizeFolder(root)];
  const queue = [String(root.id)];

  while (queue.length) {
    const folderId = queue.shift()!;
    const children = (await paginate(`/folders/${encodeURIComponent(folderId)}/children`, {
      limit: 100,
      delayMs,
    })) as Json[];

    for (const child of children) {
      const row = normalizeFolder(child, folderId);
      folders.push(row);
      if (row.subfolders_count > 0) queue.push(row.id);
    }
    process.stdout.write(`\rfolders: ${folders.length} (queue ${queue.length})   `);
  }
  process.stdout.write("\n");
  return { root, folders };
}

function toMarkdown(meta: Json, publication: Json, folders: FolderRow[], jobsPath: string) {
  const lines = [
    `# ${publication.name || meta.slug}`,
    "",
    `- Author: @${meta.username}`,
    `- Slug: ${meta.slug}`,
    `- Source: ${meta.sourceUrl}`,
    `- Exported: ${meta.exportedAt}`,
    `- Folders: ${folders.length}`,
    `- Jobs file: ${jobsPath}`,
    "",
    String(publication.description || ""),
    "",
    "## Folder tree",
    "",
  ];

  for (const folder of folders) {
    const depth = Math.max(0, folder.path.split("/").filter(Boolean).length - 1);
    lines.push(
      `${"  ".repeat(depth)}- ${folder.name} (\`${folder.id}\`, ${folder.count} items)`
    );
  }

  lines.push("");
  lines.push(
    "> `scene-shots.jsonl` is the easiest scene-level export: one generation/shot per line with its resolved scene, full prompt, reference media, and output URL. `jobs.jsonl` preserves the richer normalized API records. `scene-index.json` summarizes scenes; `references.json` is the deduplicated reference-media manifest."
  );
  return lines.join("\n");
}

async function main() {
  const {
    username,
    slug,
    maxJobs,
    outDir,
    delayMs,
    concurrency,
    downloadReferences,
    refresh,
  } = parseArgs(process.argv.slice(2));
  const targetDir =
    outDir ||
    path.join(process.cwd(), "data", "higgsfield", `${username}__${slug}`);

  await mkdir(targetDir, { recursive: true });

  const publicationPath = path.join(targetDir, "publication.json");
  const foldersPath = path.join(targetDir, "folders.json");
  const jobsPath = path.join(targetDir, "jobs.jsonl");
  const progressPath = path.join(targetDir, "progress.json");
  const readmePath = path.join(targetDir, "README.md");
  const metaPath = path.join(targetDir, "meta.json");

  console.log(`Fetching publication @${username}/${slug} …`);
  const publication = (await apiGet(
    `/project-publications/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`
  )) as Json;
  await writeFile(publicationPath, JSON.stringify(publication, null, 2));

  const snapshotFolderId = String(publication.snapshot_folder_id || "");
  if (!snapshotFolderId) {
    throw new Error("No snapshot_folder_id on publication");
  }

  console.log(
    `Project: ${publication.name} · generations=${(publication.stats as Json | undefined)?.generations_count ?? "?"}`
  );

  let folders: FolderRow[];
  let progress: ProgressState | null = null;

  if (await exists(progressPath)) {
    progress = JSON.parse(await readFile(progressPath, "utf8")) as ProgressState;
  }

  if (await exists(foldersPath)) {
    folders = JSON.parse(await readFile(foldersPath, "utf8")) as FolderRow[];
    console.log(`Loaded existing folder tree: ${folders.length}`);
  } else {
    console.log("Walking folder tree…");
    const walked = await walkFolders(snapshotFolderId, delayMs);
    folders = walked.folders;
    await writeFile(foldersPath, JSON.stringify(folders, null, 2));
  }

  const seen = new Set<string>();
  if (await exists(jobsPath)) {
    const existing = createInterface({
      input: createReadStream(jobsPath),
      crlfDelay: Infinity,
    });
    for await (const line of existing) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as { id?: string };
        if (row.id) seen.add(row.id);
      } catch {
        // skip corrupt line
      }
    }
    console.log(`Resume: ${seen.size} jobs already on disk`);
  }

  const legacyFolderIndex = Math.max(0, progress?.folderIndex || 0);
  const completedFolderIds = new Set(
    refresh
      ? []
      : progress?.completedFolderIds ||
          folders.slice(0, legacyFolderIndex).map((folder) => folder.id)
  );
  let folderIndex = folders.findIndex(
    (folder) => !completedFolderIds.has(folder.id)
  );
  if (folderIndex < 0) folderIndex = folders.length;
  let jobsWritten = seen.size;
  let stopAll = Boolean(maxJobs && jobsWritten >= maxJobs);

  const jobsStream = createWriteStream(jobsPath, {
    flags: jobsWritten > 0 ? "a" : "w",
    encoding: "utf8",
  });
  let writeChain = Promise.resolve();
  let progressChain = Promise.resolve();

  const saveProgress = () => {
    const firstIncomplete = folders.findIndex(
      (folder) => !completedFolderIds.has(folder.id)
    );
    folderIndex = firstIncomplete < 0 ? folders.length : firstIncomplete;
    const next: ProgressState = {
      username,
      slug,
      snapshotFolderId,
      folderIndex,
      completedFolderIds: [...completedFolderIds],
      jobsWritten,
      updatedAt: new Date().toISOString(),
    };
    progressChain = progressChain.then(async () => {
      const tmp = `${progressPath}.tmp`;
      await writeFile(tmp, JSON.stringify(next, null, 2));
      await rename(tmp, progressPath);
    });
    return progressChain;
  };

  const appendJob = (job: NonNullable<ReturnType<typeof normalizeJob>>) => {
    writeChain = writeChain.then(async () => {
      if (seen.has(job.id) || stopAll) return;
      seen.add(job.id);
      const line = `${JSON.stringify(job)}\n`;
      if (!jobsStream.write(line)) {
        await once(jobsStream, "drain");
      }
      jobsWritten += 1;
      if (jobsWritten % 100 === 0) {
        process.stdout.write(
          `\rjobs: ${jobsWritten}/${folders[0]?.count || "?"} · completed folders ${completedFolderIds.size}/${folders.length}   `
        );
      }
      if (maxJobs && jobsWritten >= maxJobs) stopAll = true;
    });
    return writeChain;
  };

  console.log(
    `Downloading jobs from folder ${folderIndex + 1}/${folders.length}` +
      (maxJobs ? ` (max ${maxJobs})` : " (all)") +
      ` with concurrency ${concurrency}…`
  );

  try {
    const pendingFolderIndexes = folders
      .map((_, index) => index)
      .filter((index) => !completedFolderIds.has(folders[index].id));
    let nextFolder = 0;

    async function worker() {
      for (;;) {
        if (stopAll) return;
        const pendingIndex = nextFolder++;
        if (pendingIndex >= pendingFolderIndexes.length) return;
        const currentFolderIndex = pendingFolderIndexes[pendingIndex];
        const folder = folders[currentFolderIndex];
        let stoppedMidFolder = false;

        await paginate(`/folders/${encodeURIComponent(folder.id)}/items/v2`, {
          limit: 50,
          delayMs,
          onPage: async (batch) => {
            for (const item of batch as Json[]) {
              if (stopAll) {
                stoppedMidFolder = true;
                return true;
              }
              const job = normalizeJob(item, folder);
              if (!job) continue;
              await appendJob(job);
            }
            if (stopAll) stoppedMidFolder = true;
            await saveProgress();
            return stopAll;
          },
        });

        if (!stoppedMidFolder) {
          completedFolderIds.add(folder.id);
        }
        await saveProgress();
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(concurrency, Math.max(1, pendingFolderIndexes.length)) },
        () => worker()
      )
    );
  } finally {
    await writeChain;
    jobsStream.end();
    await finished(jobsStream);
    await saveProgress();
    await progressChain;
  }

  process.stdout.write("\n");

  const meta = {
    username,
    slug,
    sourceUrl: `https://higgsfield.ai/@${username}/projects/${slug}`,
    exportedAt: new Date().toISOString(),
    apiBase: API_BASE,
    snapshotFolderId,
    originalFolderId: publication.original_folder_id ?? null,
    folders: folders.length,
    jobsWritten,
    completedFolders: completedFolderIds.size,
    truncated: Boolean(
      (maxJobs && jobsWritten >= maxJobs) || completedFolderIds.size < folders.length
    ),
    maxJobs: maxJobs || null,
  };

  await writeFile(metaPath, JSON.stringify(meta, null, 2));
  await writeFile(
    readmePath,
    toMarkdown(meta, publication, folders, path.basename(jobsPath))
  );

  console.log("Building scene and reference indexes…");
  const stats = await buildIndexes(
    targetDir,
    jobsPath,
    folders,
    publication,
    completedFolderIds,
    downloadReferences,
    concurrency
  );

  console.log(`Done → ${targetDir}`);
  console.log(`  folders: ${folders.length}`);
  console.log(`  jobs:    ${jobsWritten}${meta.truncated ? " (truncated)" : ""}`);
  console.log(`  refs:    ${stats.unique_reference_media} unique media`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
