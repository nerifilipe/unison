import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, json, message } from "./api";
import { useAuth } from "./Auth";
import { usePlayer } from "./Player";
import type { Track } from "./types";

export type RoomState = {
  id: string;
  name: string;
  hostId: string;
  revision: number;
  serverTime: number;
  track: Track | null;
  playing: boolean;
  position: number;
  members: { id: string; displayName: string; online: boolean }[];
  queue: { id: string; track: Track; votes: number; voted: boolean }[];
};
type Rooms = {
  state: RoomState | null;
  roomId: string | null;
  connection: string;
  error: string;
  busy: boolean;
  join: (id: string) => Promise<void>;
  create: (name: string) => Promise<string>;
  leave: () => Promise<void>;
  command: (path: string, method: string, body?: unknown) => Promise<void>;
  control: (action: string, position?: number) => Promise<void>;
};
const Context = createContext<Rooms | null>(null);
export function useRooms() {
  const value = useContext(Context);
  if (!value) throw new Error("RoomsProvider required");
  return value;
}
export function RoomsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { syncRoom } = usePlayer();
  const storageKey = `unison-room-${user?.id ?? "guest"}`;
  const [roomId, setRoomId] = useState<string | null>(() =>
    user ? sessionStorage.getItem(storageKey) : null,
  );
  const [state, setState] = useState<RoomState | null>(null);
  const [connection, setConnection] = useState("offline");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const current = useRef<RoomState | null>(null);
  const offset = useRef(0);
  const clockReady = useRef(false);
  const liveId = useRef(roomId);
  liveId.current = roomId;
  function accept(next: RoomState, echo?: number | null) {
    if (next.id !== liveId.current) return;
    if (
      current.current?.id === next.id &&
      (next.revision < current.current.revision ||
        next.serverTime < current.current.serverTime)
    )
      return;
    const now = Date.now();
    if (echo != null) {
      offset.current = next.serverTime - (echo + now) / 2;
      clockReady.current = true;
    } else if (!clockReady.current) offset.current = next.serverTime - now;
    current.current = next;
    setState(next);
    syncRoom({
      id: next.id,
      name: next.name,
      track: next.track,
      playing: next.playing,
      position:
        next.position +
        (next.playing
          ? Math.max(0, now + offset.current - next.serverTime) / 1000
          : 0),
      received: now,
    });
  }
  function clear() {
    liveId.current = null;
    setRoomId(null);
    setState(null);
    current.current = null;
    sessionStorage.removeItem(storageKey);
    syncRoom(null);
  }
  useEffect(() => {
    if (!roomId || !user) return;
    let active = true,
      socket: WebSocket | null = null,
      retry: ReturnType<typeof setTimeout>,
      ping: ReturnType<typeof setInterval>,
      watchdog: ReturnType<typeof setInterval>;
    let attempts = 0,
      lastMessage = Date.now();
    clockReady.current = false;
    // Lock independent playback immediately, including while restoring a saved room.
    syncRoom({
      id: roomId,
      name: "Connecting…",
      track: null,
      playing: false,
      position: 0,
      received: Date.now(),
    });
    function pause() {
      const value = current.current;
      if (value)
        syncRoom({
          id: value.id,
          name: value.name,
          track: value.track,
          playing: false,
          position: value.position,
          received: Date.now(),
        });
    }
    async function connect() {
      if (!active) return;
      setConnection(attempts ? "reconnecting" : "connecting");
      try {
        await api<RoomState>(`/api/rooms/${roomId}`);
      } catch (failure) {
        if (!active) return;
        if (
          failure instanceof ApiError &&
          [401, 404].includes(failure.status)
        ) {
          setError(message(failure));
          clear();
          return;
        }
        setError("Connection lost. Retrying…");
        retry = setTimeout(connect, Math.min(10000, 1000 * 2 ** attempts++));
        return;
      }
      if (!active) return;
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/rooms/${roomId}`,
      );
      socket.onopen = () => {
        if (!active) return;
        lastMessage = Date.now();
        socket?.send(String(Date.now()));
        ping = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN)
            socket.send(String(Date.now()));
        }, 5000);
        watchdog = setInterval(() => {
          if (Date.now() - lastMessage > 6000) {
            pause();
            socket?.close();
          }
        }, 1000);
      };
      socket.onmessage = (event) => {
        if (!active) return;
        const envelope = JSON.parse(event.data) as {
          state: RoomState;
          echo: number | null;
        };
        lastMessage = Date.now();
        if (attempts > 0) setError("");
        attempts = 0;
        setConnection("connected");
        accept(envelope.state, envelope.echo);
      };
      socket.onclose = (event) => {
        clearInterval(ping);
        clearInterval(watchdog);
        if (!active) return;
        pause();
        if (event.code === 4001) {
          setError("Session expired. Sign in again.");
          clear();
          window.dispatchEvent(new Event("unison-session-expired"));
          return;
        }
        if (event.code === 1008) {
          setError(event.reason || "Room connection closed.");
          clear();
          void api("/api/auth/me").catch((failure) => {
            if (failure instanceof ApiError && failure.status === 401)
              window.dispatchEvent(new Event("unison-session-expired"));
          });
          return;
        }
        if (event.code === 4004 || event.code === 4008) {
          setError(event.reason || "This room has ended.");
          clear();
          return;
        }
        setConnection("reconnecting");
        retry = setTimeout(connect, Math.min(10000, 1000 * 2 ** attempts++));
      };
    }
    void connect();
    return () => {
      active = false;
      clearTimeout(retry);
      clearInterval(ping);
      clearInterval(watchdog);
      socket?.close();
      syncRoom(null);
    };
  }, [roomId, user?.id, syncRoom]);
  async function enter(next: RoomState) {
    sessionStorage.setItem(storageKey, next.id);
    liveId.current = next.id;
    current.current = null;
    setRoomId(next.id);
    setState(next);
    setError("");
  }
  async function create(name: string) {
    if (roomId) throw new Error("Leave your current room first.");
    const next = await api<RoomState>("/api/rooms", json("POST", { name }));
    await enter(next);
    return next.id;
  }
  async function join(id: string) {
    if (roomId && roomId !== id)
      throw new Error("Leave your current room first.");
    if (roomId === id) return;
    await enter(
      await api<RoomState>(`/api/rooms/${id}/join`, { method: "POST" }),
    );
  }
  async function leave() {
    if (!roomId) return;
    try {
      await api(`/api/rooms/${roomId}/membership`, { method: "DELETE" });
    } catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 404))
        throw failure;
    }
    clear();
  }
  async function command(path: string, method: string, body?: unknown) {
    if (!roomId || connection !== "connected" || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      accept(
        await api<RoomState>(
          `/api/rooms/${roomId}${path}`,
          body === undefined ? { method } : json(method, body),
        ),
      );
    } catch (failure) {
      setError(message(failure));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function control(action: string, position = 0) {
    await command("/control", "POST", {
      action,
      position,
      revision: current.current?.revision ?? 0,
    });
  }
  return (
    <Context.Provider
      value={{
        state,
        roomId,
        connection,
        error,
        busy,
        join,
        create,
        leave,
        command,
        control,
      }}
    >
      {children}
    </Context.Provider>
  );
}
