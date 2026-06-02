import fs from 'fs';
import path from 'path';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

export interface VisualAssetFileJob {
  id: string;
  result?: string | null;
  error?: string | null;
}

export function getVisualAssetImagePaths(job: VisualAssetFileJob): string[] {
  const outputDir = visualAssetOutputDir(job.id);
  const files = new Set<string>();

  for (const file of extractExistingFiles([job.result || '', job.error || ''], IMAGE_EXTENSIONS)) {
    if (isPathInside(file, outputDir)) {
      files.add(file);
    }
  }

  for (const file of listFilesByExtension(outputDir, IMAGE_EXTENSIONS)) {
    files.add(file);
  }

  return Array.from(files).sort((a, b) => a.localeCompare(b));
}

export function getVisualAssetImageUrls(movieId: string, job: VisualAssetFileJob): string[] {
  return getVisualAssetImagePaths(job).map((_, index) =>
    `/api/movies/${encodeURIComponent(movieId)}/visual-assets/${encodeURIComponent(job.id)}/file?index=${index}`
  );
}

function visualAssetOutputDir(jobId: string): string {
  return path.resolve(process.cwd(), 'outputs', 'visual-assets', jobId);
}

function extractExistingFiles(values: string[], extensions: string[]): string[] {
  const files = new Set<string>();
  const pattern = new RegExp(`(?:/[^\\n\\s"'\\\`]+(?:${extensions.map(escapeRegExp).join('|')}))`, 'gi');
  for (const value of values) {
    const matches = value.match(pattern) || [];
    for (const match of matches) {
      const resolved = path.resolve(match);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        files.add(resolved);
      }
    }
  }
  return Array.from(files);
}

function listFilesByExtension(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  const walk = (currentDir: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  };

  walk(dir);
  return files;
}

function isPathInside(file: string, dir: string): boolean {
  const relative = path.relative(dir, file);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
