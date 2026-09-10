import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Music2, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { formatTime, type Track } from "./types";
import { Link } from "react-router-dom";
import { TrackCredits } from "./TrackCredits";

export type RoomPlayback = {
  id: string;
  name: string;
  track: Track | null;
  playing: boolean;
  position: number;
  received: number;
};

type PlayerState = {
  track: Track | null;
  playing: boolean;
  select: (track: Track) => void;
  syncRoom: (state: RoomPlayback | null) => void;
  roomMode: boolean;
};
const PlayerContext = createContext<PlayerState | null>(null);
export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("PlayerProvider is required");
  return value;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const remote = useRef<RoomPlayback | null>(null);
  const remoteEnabled = useRef(false);
  const [room, setRoom] = useState<RoomPlayback | null>(null);
  const [roomReady, setRoomReady] = useState(false);
  const remoteTrack = useRef<string | null>(null);
  const remoteStarting = useRef(false);
  const applyRemote = useCallback(() => {
    const state = remote.current,
      element = audio.current;
    if (!state || !element || !state.track) return;
    const desired = Math.min(
      state.track.durationSeconds,
      state.position +
        (state.playing ? Math.max(0, Date.now() - state.received) / 1000 : 0),
    );
    if (
      element.readyState >= 1 &&
      Math.abs(element.currentTime - desired) > 0.6
    )
      element.currentTime = desired;
    if (!state.playing || !remoteEnabled.current) {
      element.pause();
      return;
    }
    if (element.paused && !remoteStarting.current) {
      remoteStarting.current = true;
      const request = requestId.current;
      void element
        .play()
        .catch(() => {
          if (request !== requestId.current) return;
          remoteEnabled.current = false;
          setRoomReady(false);
          setError(
            "Your browser needs permission to play. Select Enable room audio.",
          );
        })
        .finally(() => {
          remoteStarting.current = false;
        });
    }
  }, []);
  const syncRoom = useCallback(
    (state: RoomPlayback | null) => {
      const previous = remote.current;
      if (!state) {
        if (previous) {
          requestId.current++;
          audio.current?.pause();
          setLoading(false);
          setError("");
        }
        remote.current = null;
        remoteTrack.current = null;
        remoteEnabled.current = false;
        setRoomReady(false);
        setRoom(null);
        return;
      }
      if (!previous || previous.id !== state.id) {
        remoteEnabled.current = false;
        setRoomReady(false);
        audio.current?.pause();
      }
      remote.current = state;
      setRoom(state);
      if (remoteTrack.current !== state.track?.id) {
        requestId.current++;
        remoteTrack.current = state.track?.id ?? null;
        setTrack(state.track);
        setTime(0);
        setDuration(0);
        setError("");
        if (audio.current) {
          audio.current.pause();
          if (state.track) audio.current.src = state.track.audioUrl;
          else {
            audio.current.removeAttribute("src");
            audio.current.load();
          }
        }
      }
      applyRemote();
    },
    [applyRemote],
  );
  useEffect(() => {
    const timer = setInterval(applyRemote, 400);
    return () => clearInterval(timer);
  }, [applyRemote]);

  async function play() {
    const element = audio.current;
    if (!element) return;
    const request = ++requestId.current;
    setError("");
    setLoading(true);
    try {
      await element.play();
    } catch (failure) {
      if (
        request === requestId.current &&
        !(failure instanceof DOMException && failure.name === "AbortError")
      ) {
        setError(
          "This track could not play. Check your connection and try again.",
        );
        setPlaying(false);
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  function toggle() {
    if (!audio.current || !track) return;
    if (!audio.current.paused) {
      requestId.current++;
      audio.current.pause();
      setLoading(false);
    } else {
      void play();
    }
  }

  function select(next: Track) {
    if (remote.current) {
      setError(
        "Leave the listening room to play independently. Add songs from the room queue.",
      );
      return;
    }
    if (!audio.current) return;
    if (track?.id === next.id) {
      toggle();
      return;
    }
    requestId.current++;
    setTrack(next);
    setTime(0);
    setDuration(0);
    audio.current.src = next.audioUrl;
    audio.current.volume = volume;
    void play();
  }

  return (
    <PlayerContext.Provider
      value={{ track, playing, select, syncRoom, roomMode: !!room }}
    >
      {children}
      <footer className="player" aria-label="Music player">
        <audio
          ref={audio}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setLoading(false);
          }}
          onTimeUpdate={() => setTime(audio.current?.currentTime ?? 0)}
          onLoadedMetadata={() => {
            setDuration(audio.current?.duration ?? 0);
            applyRemote();
          }}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
          onCanPlay={() => setLoading(false)}
          onError={() => {
            setError("Audio is unavailable. Try this track again.");
            setLoading(false);
            setPlaying(false);
          }}
        />
        <div className="now-playing">
          <div
            className={`artwork mini ${track?.artwork ?? "empty-art"}`}
            aria-hidden="true"
          >
            {!track && <Music2 size={23} />}
          </div>
          <div>
            <strong>{track?.title ?? "Nothing playing"}</strong>
            <span>{track?.artist ?? "Pick a track to start listening"}</span>
            {room && (
              <Link className="room-player-link" to={`/rooms/${room.id}`}>
                In room: {room.name}
              </Link>
            )}
          </div>
          {track && <TrackCredits track={track} />}
        </div>
        <div className="transport">
          <div className="transport-buttons">
            <button
              className="icon-button restart"
              aria-label="Restart track"
              disabled={!track || !!room}
              onClick={() => {
                if (audio.current) audio.current.currentTime = 0;
              }}
            >
              <RotateCcw size={17} />
            </button>
            <button
              className="play-control"
              aria-label={playing ? "Pause" : "Play"}
              disabled={!track || !!room}
              onClick={toggle}
            >
              {playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>
            <span className="play-status" role="status">
              {loading
                ? "Loading audio…"
                : playing
                  ? "Playing"
                  : track
                    ? "Paused"
                    : "Ready"}
            </span>
          </div>
          <div className="timeline">
            <span>{formatTime(time)}</span>
            <input
              aria-label="Seek"
              aria-valuetext={`${Math.round(time)} seconds of ${Math.round(duration || track?.durationSeconds || 0)} seconds`}
              type="range"
              min="0"
              max={duration || track?.durationSeconds || 60}
              step="0.1"
              value={time}
              disabled={!duration || !!room}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (audio.current) audio.current.currentTime = next;
                setTime(next);
              }}
            />
            <span>{formatTime(duration || track?.durationSeconds || 0)}</span>
          </div>
        </div>
        <label className="volume">
          <Volume2 size={19} />
          <input
            aria-label="Volume"
            aria-valuetext={`${Math.round(volume * 100)} percent`}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              if (audio.current) audio.current.volume = next;
            }}
          />
        </label>
        {room && !roomReady && (
          <button
            className="room-audio-enable"
            disabled={!room.track}
            onClick={() => {
              remoteEnabled.current = true;
              setRoomReady(true);
              setError("");
              if (audio.current && !remote.current?.playing) {
                void audio.current
                  .play()
                  .then(() => {
                    if (!remote.current?.playing) audio.current?.pause();
                  })
                  .catch(() => {
                    remoteEnabled.current = false;
                    setRoomReady(false);
                  });
              } else applyRemote();
            }}
          >
            Enable room audio
          </button>
        )}
        {error && (
          <div className="player-error" role="alert">
            {error}{" "}
            <button
              onClick={() => {
                if (remote.current) {
                  setError("");
                  remoteEnabled.current = true;
                  setRoomReady(true);
                  audio.current?.load();
                  applyRemote();
                } else {
                  audio.current?.load();
                  void play();
                }
              }}
            >
              Retry audio
            </button>
          </div>
        )}
      </footer>
    </PlayerContext.Provider>
  );
}
