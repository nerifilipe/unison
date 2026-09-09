import type { Track } from "./types";
export type PlaylistSummary = {
  id: string;
  name: string;
  description: string;
  trackCount: number;
};
export type PlaylistDetail = {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
};
