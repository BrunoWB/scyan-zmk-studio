import changelogRaw from './changelog.json';

export interface PatchEntry {
  patch: string;
  date: string;
  commitHash?: string;
  changes: string[];
}

export interface ReleaseEntry {
  version: string;
  type: 'major' | 'minor';
  title: string;
  description: string;
  date: string;
  highlights: string[];
  patches: PatchEntry[];
}

export const REPOSITORY_URL = 'https://github.com/BrunoWB/scyan-zmk-studio';

export const CHANGELOG_DATA: ReleaseEntry[] = changelogRaw as ReleaseEntry[];
