import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Music2, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { formatTime, type Track } from "./types";

type PlayerState = {
  track: Track | null;
  playing: boolean;
  select: (track: Track) => void;
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
    <PlayerContext.Provider value={{ track, playing, select }}>
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
          onLoadedMetadata={() => setDuration(audio.current?.duration ?? 0)}
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
            <strong>{track?.title ?? "Your next favorite awaits"}</strong>
            <span>{track?.artist ?? "Pick a track to start listening"}</span>
          </div>
        </div>
        <div className="transport">
          <div className="transport-buttons">
            <button
              className="icon-button restart"
              aria-label="Restart track"
              disabled={!track}
              onClick={() => {
                if (audio.current) audio.current.currentTime = 0;
              }}
            >
              <RotateCcw size={17} />
            </button>
            <button
              className="play-control"
              aria-label={playing ? "Pause" : "Play"}
              disabled={!track}
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
              type="range"
              min="0"
              max={duration || track?.durationSeconds || 60}
              step="0.1"
              value={time}
              disabled={!duration}
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
        {error && (
          <div className="player-error" role="alert">
            {error}{" "}
            <button
              onClick={() => {
                audio.current?.load();
                void play();
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
