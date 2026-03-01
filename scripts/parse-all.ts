/**
 * Parse all repos listed in repos.json.
 *
 * For each repo, runs parse-repo and git-analyze with --output pointed
 * at public/data/{repoId}/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface RepoEntry {
  id: string;
  name: string;
  url: string;
  local?: boolean;
}

const ROOT = path.resolve(import.meta.dirname, '..');
const REPOS_DIR = path.join(ROOT, '.repos');
const REGISTRY = path.join(ROOT, 'public', 'data', 'repos.json');

const repos: RepoEntry[] = JSON.parse(fs.readFileSync(REGISTRY, 'utf-8'));

for (const repo of repos) {
  const repoPath = repo.local ? ROOT : path.join(REPOS_DIR, repo.id);
  const outputDir = path.join(ROOT, 'public', 'data', repo.id);

  if (!fs.existsSync(repoPath)) {
    console.warn(`[parse-all] Skipping ${repo.id}: repo not found at ${repoPath}`);
    continue;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n========== Parsing ${repo.id} ==========`);
  console.log(`  repo: ${repoPath}`);
  console.log(`  output: ${outputDir}`);

  try {
    execSync(`tsx scripts/parse-repo.ts "${repoPath}" --output "${outputDir}"`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error(`[parse-all] parse-repo failed for ${repo.id}:`, err);
  }

  try {
    execSync(`tsx scripts/git-analyze.ts "${repoPath}" --output "${outputDir}"`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error(`[parse-all] git-analyze failed for ${repo.id}:`, err);
  }
}

console.log('\n[parse-all] Done.');
