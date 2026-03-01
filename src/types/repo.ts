export interface RepoInfo {
  id: string;
  name: string;
  description: string;
  language: string;
  stars: number;
  url: string;
  local?: boolean;
}
