/**
 * Language detection and file filtering utilities.
 */

import type { SupportedLanguage } from './queries';

export const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '__pycache__',
  '.next',
  'coverage',
  'GitNexus',
  '.claude',
  '.vscode',
  '.idea',
  '.repos',   // cloned sponsor repos — don't recurse into them when parsing hackstral
  'venv',
  '.venv',
  'env',
  '.eggs',
  '*.egg-info',
]);

/** Skip files larger than 512KB (likely generated/vendored) */
export const MAX_FILE_SIZE = 512 * 1024;

export interface LanguageInfo {
  language: SupportedLanguage;
  isTSX: boolean;
}

/**
 * Detect language from file extension. Returns null for unsupported files.
 */
export function getLanguageFromFilename(filename: string): LanguageInfo | null {
  if (filename.endsWith('.tsx')) return { language: 'typescript', isTSX: true };
  if (filename.endsWith('.ts')) return { language: 'typescript', isTSX: false };
  if (filename.endsWith('.jsx')) return { language: 'javascript', isTSX: false };
  if (filename.endsWith('.js')) return { language: 'javascript', isTSX: false };
  if (filename.endsWith('.mjs')) return { language: 'javascript', isTSX: false };
  if (filename.endsWith('.cjs')) return { language: 'javascript', isTSX: false };
  if (filename.endsWith('.py')) return { language: 'python', isTSX: false };
  return null;
}

/**
 * Check if a directory path segment should be ignored.
 */
export function shouldIgnoreDir(dirName: string): boolean {
  return IGNORE_DIRS.has(dirName);
}
