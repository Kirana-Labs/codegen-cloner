export interface PRInfo {
  owner: string;
  repo: string;
  branch: string;
  prNumber: number;
}

export interface SystemChecks {
  dockerInstalled: boolean;
  pnpmInstalled: boolean;
  postgresRunning: boolean;
}

export interface ProjectStatus {
  exists: boolean;
  path: string;
  isUpToDate?: boolean;
}