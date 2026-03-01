/**
 * Clone sponsor repos for multi-repo demo.
 *
 * Reads public/data/repos.json, clones each to .repos/{repoId}/ (shallow).
 * Skips repos marked as local (e.g. hackstral itself).
 * Pulls if already cloned.
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

fs.mkdirSync(REPOS_DIR, { recursive: true });

for (const repo of repos) {
  if (repo.local) {
    console.log(`[clone-repos] Skipping ${repo.id} (local)`);
    continue;
  }

  const dest = path.join(REPOS_DIR, repo.id);

  if (fs.existsSync(path.join(dest, '.git'))) {
    // If cloned as shallow, unshallow first so git-analyze sees full history
    const isShallow = execSync('git rev-parse --is-shallow-repository', { cwd: dest }).toString().trim();
    if (isShallow === 'true') {
      console.log(`[clone-repos] Unshallowing ${repo.id}...`);
      execSync('git fetch --unshallow', { cwd: dest, stdio: 'inherit' });
    } else {
      console.log(`[clone-repos] Pulling ${repo.id}...`);
      execSync('git pull', { cwd: dest, stdio: 'inherit' });
    }
  } else {
    console.log(`[clone-repos] Cloning ${repo.id} from ${repo.url}...`);
    execSync(`git clone ${repo.url} ${dest}`, { stdio: 'inherit' });
  }
}

console.log('\n[clone-repos] Done.');
