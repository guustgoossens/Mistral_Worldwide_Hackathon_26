/**
 * Git history analysis → public/data/git-data.json
 *
 * Usage: bun run git-analyze -- /path/to/repo
 *
 * Extracts per-file contributor stats from git log (last 1000 commits).
 */

import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';

interface FileStats {
  filePath: string;
  commits: number;
  linesChanged: number;
  lastTouch: string; // ISO date
}

interface Contributor {
  id: string;
  name: string;
  email: string;
  files: FileStats[];
}

interface GitDataJSON {
  repoPath: string;
  analyzedAt: string;
  stats: {
    totalCommits: number;
    totalContributors: number;
    totalFiles: number;
  };
  contributors: Contributor[];
}

// Parse CLI args
let repoPath: string | undefined;
let outputDirOverride: string | undefined;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--output' && process.argv[i + 1]) {
    outputDirOverride = process.argv[++i];
  } else if (!repoPath) {
    repoPath = process.argv[i];
  }
}

if (!repoPath) {
  console.error('Usage: bun run git-analyze -- /path/to/repo [--output /path/to/output]');
  process.exit(1);
}

const absRepoPath = path.resolve(repoPath);
if (!fs.existsSync(absRepoPath)) {
  console.error(`Repo path does not exist: ${absRepoPath}`);
  process.exit(1);
}

console.log(`[git-analyze] Analyzing: ${absRepoPath}`);
const startTime = Date.now();

const git = simpleGit(absRepoPath);

// Get commit log with file stats (numstat)
const COMMIT_SEP = '---COMMIT_SEP---';
const logResult = await git.raw([
  'log',
  '-n', '1000',
  '--numstat',
  `--format=${COMMIT_SEP}%n%H|%ae|%an|%aI`,
]);

// Parse the raw log output
interface CommitInfo {
  hash: string;
  email: string;
  name: string;
  date: string;
  files: Array<{ path: string; added: number; deleted: number }>;
}

const commits: CommitInfo[] = [];
const blocks = logResult.split(COMMIT_SEP).filter(b => b.trim());

for (const block of blocks) {
  const lines = block.trim().split('\n');
  if (lines.length === 0) continue;

  const headerLine = lines[0];
  const parts = headerLine.split('|');
  if (parts.length < 4) continue;

  const hash = parts[0];
  const email = parts[1];
  const name = parts[2];
  const date = parts.slice(3).join('|'); // ISO date might have timezone info

  const files: CommitInfo['files'] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // numstat format: <added>\t<deleted>\t<path>
    const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (match) {
      const added = match[1] === '-' ? 0 : parseInt(match[1], 10);
      const deleted = match[2] === '-' ? 0 : parseInt(match[2], 10);
      files.push({ path: match[3], added, deleted });
    }
  }

  commits.push({ hash, email, name, date, files });
}

console.log(`Parsed ${commits.length} commits`);

// Build contributor map
const contributorMap = new Map<string, {
  name: string;
  email: string;
  files: Map<string, { commits: number; linesChanged: number; lastTouch: string }>;
}>();

for (const commit of commits) {
  if (!contributorMap.has(commit.email)) {
    contributorMap.set(commit.email, {
      name: commit.name,
      email: commit.email,
      files: new Map(),
    });
  }

  const contributor = contributorMap.get(commit.email)!;

  for (const file of commit.files) {
    const existing = contributor.files.get(file.path);
    const linesChanged = file.added + file.deleted;

    if (existing) {
      existing.commits++;
      existing.linesChanged += linesChanged;
      // Keep the most recent date
      if (commit.date > existing.lastTouch) {
        existing.lastTouch = commit.date;
      }
    } else {
      contributor.files.set(file.path, {
        commits: 1,
        linesChanged,
        lastTouch: commit.date,
      });
    }
  }
}

// Build output
const allFilePaths = new Set<string>();
const contributors: Contributor[] = [];

for (const [email, data] of contributorMap) {
  const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const files: FileStats[] = [];

  for (const [filePath, stats] of data.files) {
    allFilePaths.add(filePath);
    files.push({
      filePath,
      commits: stats.commits,
      linesChanged: stats.linesChanged,
      lastTouch: stats.lastTouch,
    });
  }

  // Sort files by commits descending
  files.sort((a, b) => b.commits - a.commits);

  contributors.push({
    id: `p:${sanitizedEmail}`,
    name: data.name,
    email,
    files,
  });
}

// Sort contributors by total commits descending
contributors.sort((a, b) => {
  const aTotal = a.files.reduce((s, f) => s + f.commits, 0);
  const bTotal = b.files.reduce((s, f) => s + f.commits, 0);
  return bTotal - aTotal;
});

const output: GitDataJSON = {
  repoPath: absRepoPath,
  analyzedAt: new Date().toISOString(),
  stats: {
    totalCommits: commits.length,
    totalContributors: contributors.length,
    totalFiles: allFilePaths.size,
  },
  contributors,
};

// Write output
const outputDir = outputDirOverride ? path.resolve(outputDirOverride) : path.join(absRepoPath, 'public', 'data');
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, 'git-data.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n--- Done in ${elapsed}s ---`);
console.log(`Output: ${outputPath}`);
console.log(`Stats: ${JSON.stringify(output.stats)}`);
