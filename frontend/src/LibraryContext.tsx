import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./Auth";
import type { Track } from "./types";

type Library = {
  favorites: Track[];
  status: "loading" | "ready" | "error";
  reload: () => void;
  toggle: (track: Track) => Promise<void>;
};
const LibraryContext = createContext<Library | null>(null);
export function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("LibraryProvider required");
  return value;
}
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <LibrarySession key={user?.id ?? "guest"} enabled={!!user}>
      {children}
    </LibrarySession>
  );
}
function LibrarySession({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [status, setStatus] = useState<Library["status"]>(
    enabled ? "loading" : "ready",
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setStatus("loading");
    api<Track[]>("/api/library/favorites")
      .then((value) => {
        if (active) {
          setFavorites(value);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [enabled, revision]);
  async function toggle(track: Track) {
    const exists = favorites.some((value) => value.id === track.id);
    await api(`/api/library/favorites/${encodeURIComponent(track.id)}`, {
      method: exists ? "DELETE" : "PUT",
    });
    setFavorites((current) =>
      exists
        ? current.filter((value) => value.id !== track.id)
        : [track, ...current.filter((value) => value.id !== track.id)],
    );
  }
  return (
    <LibraryContext.Provider
      value={{
        favorites,
        status,
        reload: () => setRevision((value) => value + 1),
        toggle,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}
