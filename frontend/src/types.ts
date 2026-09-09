export type Track = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  durationSeconds: number;
  audioUrl: string;
  artwork: string;
};

export function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
