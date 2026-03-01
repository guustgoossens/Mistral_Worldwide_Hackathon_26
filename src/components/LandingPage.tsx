import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Code2, GitFork, Star } from "lucide-react";
import type { RepoInfo } from "@/types/repo";

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3572A5",
  Rust: "#DEA584",
  Go: "#00ADD8",
};

export function LandingPage() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);

  useEffect(() => {
    fetch("/data/repos.json")
      .then((r) => r.json())
      .then(setRepos)
      .catch(console.error);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-bg px-4">
      <div className="mb-12 flex flex-col items-center">
        <img src="/favicon.svg" alt="Summa" className="mb-4 h-20 w-20 drop-shadow-[0_0_24px_rgba(232,92,15,0.4)]" />
        <h1 className="mb-2 text-3xl font-bold gradient-text">Summa</h1>
        <p className="text-center text-text-muted">
          Voice-driven codebase intelligence. Pick a repo to explore.
        </p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {repos.map((repo) => (
          <Link
            key={repo.id}
            to={`/${repo.id}`}
            className="group rounded-[12px] border border-border bg-surface p-5 transition-all hover:border-accent hover:bg-elevated"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-elevated group-hover:bg-surface">
                <Code2 className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-text">{repo.name}</h2>
              </div>
            </div>

            <p className="mb-4 line-clamp-2 text-sm text-text-muted">{repo.description}</p>

            <div className="flex items-center gap-4 text-xs text-text-tertiary">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: LANGUAGE_COLORS[repo.language] ?? "#888" }}
                />
                {repo.language}
              </span>
              {repo.stars > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {repo.stars.toLocaleString()}
                </span>
              )}
              {!repo.local && (
                <span className="flex items-center gap-1">
                  <GitFork className="h-3 w-3" />
                  Clone
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
