import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Copy,
  Headphones,
  Plus,
  Radio,
  SkipForward,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useRooms } from "./RoomsContext";
import { useAuth } from "./Auth";
import { api, message } from "./api";
import { formatTime, type Track } from "./types";
import { TrackCredits } from "./TrackCredits";

export function RoomsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const room = useRooms();
  const state = room.state;
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const current = !!state && state.id === id && room.roomId === id;
  const host = current && state.hostId === user?.id;
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    await run(async () => navigate(`/rooms/${await room.create(name)}`));
  }
  async function join(value: string) {
    await run(async () => {
      const code = value.trim().replace(/\/$/, "").split("/").pop() ?? "";
      if (!/^[0-9a-f-]{36}$/i.test(code))
        throw new Error("Paste a valid room invitation link or room ID.");
      await room.join(code);
      navigate(`/rooms/${code}`);
    });
  }
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          Listen together <span>Rooms</span>
        </div>
      </header>
      <div className="page-content rooms-page">
        <p className="eyebrow">LISTEN TOGETHER</p>
        <h1>{current ? state.name : "Listening rooms"}</h1>
        {(error || room.error) && (
          <p role="alert" className="form-error">
            {error || room.error}
          </p>
        )}
        {!current ? (
          <>
            <p className="page-description">
              Make a room, share its invitation and build a queue together. The
              host sets the pace; everyone gets a vote.
            </p>
            {room.roomId ? (
              <div className="room-card">
                <h2>You have an active room.</h2>
                <Link className="text-link" to={`/rooms/${room.roomId}`}>
                  Return to your room →
                </Link>
              </div>
            ) : id ? (
              <div className="room-card">
                <Radio size={30} />
                <h2>You're invited.</h2>
                <p>
                  Join to see the room and its queue. You can enable audio when
                  you're ready.
                </p>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void join(id)}
                >
                  {busy ? "Joining…" : "Join room"}
                </button>
                <Link className="text-link" to="/rooms">
                  Create your own room →
                </Link>
              </div>
            ) : (
              <div className="room-entry-grid">
                <form className="room-card form-stack" onSubmit={create}>
                  <Radio size={29} />
                  <h2>Start a listening room</h2>
                  <label>
                    Room name
                    <input
                      required
                      maxLength={80}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Late-night listening"
                    />
                  </label>
                  <button className="primary-button" disabled={busy}>
                    {busy ? "Creating…" : "Create room"}
                  </button>
                </form>
                <form
                  className="room-card form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void join(invite);
                  }}
                >
                  <Headphones size={29} />
                  <h2>Meet your friends</h2>
                  <label>
                    Invitation link or room ID
                    <input
                      required
                      value={invite}
                      onChange={(event) => setInvite(event.target.value)}
                      placeholder="Paste an invitation"
                    />
                  </label>
                  <button className="secondary-button" disabled={busy}>
                    Join room
                  </button>
                </form>
              </div>
            )}
            <p className="form-note">
              Rooms are unlisted: anyone signed in with the invitation can join.
              The host controls playback and ends the room when they leave.
            </p>
          </>
        ) : (
          <>
            <div className="room-meta">
              <span
                className={`connection-badge ${room.connection}`}
                role="status"
              >
                {room.connection === "connected"
                  ? "Live · synchronized"
                  : room.connection === "connecting"
                    ? "Connecting…"
                    : "Connection lost · reconnecting…"}
              </span>
              <span>{host ? "You are the host" : "Following the host"}</span>
              <button className="text-link" onClick={() => setConfirm(true)}>
                {host ? "End room" : "Leave room"}
              </button>
            </div>
            {confirm && (
              <div className="room-card room-confirm">
                <p>
                  {host
                    ? "End this room for everyone?"
                    : "Leave this listening room?"}
                </p>
                <div className="button-row">
                  <button
                    className="danger-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await room.leave();
                        setConfirm(false);
                        navigate("/rooms");
                      })
                    }
                  >
                    Confirm {host ? "end" : "leave"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => setConfirm(false)}
                  >
                    Keep listening
                  </button>
                </div>
              </div>
            )}
            <div className="room-invite">
              <label>
                Share this invitation
                <input
                  readOnly
                  value={`${location.origin}/rooms/${state.id}`}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <button
                className="secondary-button"
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(
                      `${location.origin}/rooms/${state.id}`,
                    );
                    setCopied(true);
                  })
                }
              >
                <Copy size={16} />
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <section className="room-now room-card" aria-label="Room playback">
              <div
                className={`artwork room-art ${state.track?.artwork ?? "empty-art"}`}
              >
                <Radio size={48} />
              </div>
              <div className="room-now-info">
                <p className="eyebrow">NOW PLAYING</p>
                <h2>{state.track?.title ?? "A little quiet, for now."}</h2>
                <p>
                  {state.track?.artist ??
                    "Add songs below, then let the host press play."}
                </p>
                {state.track && <TrackCredits track={state.track} />}
                <p className="room-playback-status">
                  {state.playing ? "Playing" : "Paused"} ·{" "}
                  {formatTime(state.position)} /{" "}
                  {formatTime(state.track?.durationSeconds ?? 0)}
                </p>
                {host ? (
                  <>
                    <div className="button-row">
                      <button
                        className="primary-button"
                        disabled={
                          room.busy ||
                          room.connection !== "connected" ||
                          (!state.track && !state.queue.length)
                        }
                        onClick={() =>
                          void room.control(state.playing ? "pause" : "play")
                        }
                      >
                        {state.playing ? "Pause room" : "Play room"}
                      </button>
                      <button
                        className="secondary-button"
                        disabled={
                          room.busy ||
                          room.connection !== "connected" ||
                          (!state.track && !state.queue.length)
                        }
                        onClick={() => void room.control("next")}
                      >
                        <SkipForward size={17} />
                        Next track
                      </button>
                    </div>
                    <RoomSeek
                      key={state.track?.id ?? "empty"}
                      position={state.position}
                      duration={state.track?.durationSeconds ?? 60}
                      disabled={
                        !state.track ||
                        room.busy ||
                        room.connection !== "connected"
                      }
                      seek={(position) => room.control("seek", position)}
                    />
                  </>
                ) : (
                  <p className="form-note">
                    The host controls playback. Add songs and vote for what
                    comes next.
                  </p>
                )}
              </div>
            </section>
            <div className="room-content-grid">
              <section
                className="room-queue"
                aria-labelledby="room-queue-title"
              >
                <div className="section-heading">
                  <h2 id="room-queue-title">Up next</h2>
                  <span>{state.queue.length} queued</span>
                </div>
                <p className="form-note">
                  Most votes plays next. Ties keep the order songs were added.
                </p>
                {!state.queue.length && (
                  <div className="message-state">
                    <MusicEmpty />
                    <p>The queue is waiting for your taste.</p>
                  </div>
                )}
                {state.queue.map((entry, index) => (
                  <article className="room-queue-item" key={entry.id}>
                    <span className="queue-number">{index + 1}</span>
                    <div>
                      <h3>{entry.track.title}</h3>
                      <p>{entry.track.artist}</p>
                    </div>
                    <button
                      className="vote-button"
                      aria-label={`Vote for ${entry.track.title}`}
                      aria-pressed={entry.voted}
                      disabled={room.busy || room.connection !== "connected"}
                      onClick={() =>
                        void room.command(`/queue/${entry.id}/vote`, "PUT", {
                          enabled: !entry.voted,
                        })
                      }
                    >
                      <ThumbsUp size={16} />
                      {entry.votes}
                    </button>
                    {host && (
                      <button
                        className="icon-button"
                        aria-label={`Remove ${entry.track.title} from room`}
                        disabled={room.busy || room.connection !== "connected"}
                        onClick={() =>
                          void room.command(`/queue/${entry.id}`, "DELETE")
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </article>
                ))}
              </section>
              <aside
                className="room-members room-card"
                aria-label="Room listeners"
              >
                <h2>In good company</h2>
                {state.members.map((member) => (
                  <div className="room-member" key={member.id}>
                    <span
                      className={`presence ${member.online ? "online" : ""}`}
                    />
                    <span>
                      {member.displayName}
                      <small>
                        {member.id === state.hostId
                          ? "Host"
                          : member.online
                            ? "Listening"
                            : "Away"}
                      </small>
                    </span>
                  </div>
                ))}
              </aside>
            </div>
            <QueueSearch />
          </>
        )}
      </div>
    </>
  );
}
function RoomSeek({
  position,
  duration,
  disabled,
  seek,
}: {
  position: number;
  duration: number;
  disabled: boolean;
  seek: (position: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const send = useRef(seek);
  send.current = seek;
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <label className="room-seek">
      Room seek
      <input
        aria-label="Room seek"
        aria-valuetext={`${Math.round(draft ?? Math.min(position, duration))} seconds of ${Math.round(duration)} seconds`}
        type="range"
        min={0}
        max={duration}
        step={1}
        value={draft ?? Math.min(position, duration)}
        disabled={disabled}
        onChange={(event) => {
          const value = Number(event.target.value);
          setDraft(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            void send.current(value).finally(() => setDraft(null));
          }, 200);
        }}
      />
    </label>
  );
}
function MusicEmpty() {
  return <Headphones size={27} />;
}
function QueueSearch() {
  const room = useRooms();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatus("loading");
    const timer = setTimeout(() => {
      api<Track[]>(`/api/tracks?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((value) => {
          if (active) {
            setTracks(value);
            setStatus("ready");
          }
        })
        .catch(() => {
          if (active) setStatus("error");
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);
  return (
    <section className="room-search" aria-label="Add songs to room">
      <h2>Make it your mix.</h2>
      <label>
        Search songs to add
        <input
          maxLength={120}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, artist or genre"
        />
      </label>
      {status === "loading" ? (
        <p role="status">Finding songs…</p>
      ) : status === "error" ? (
        <div role="alert">
          Could not load songs.{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>
            Retry search
          </button>
        </div>
      ) : !tracks.length ? (
        <p>No songs found.</p>
      ) : (
        <div className="room-search-results">
          {tracks.map((track) => (
            <article key={track.id}>
              <div>
                <h3>{track.title}</h3>
                <p>
                  {track.artist} · {formatTime(track.durationSeconds)}
                </p>
              </div>
              <button
                className="secondary-button"
                aria-label={`Queue ${track.title}`}
                disabled={
                  room.busy ||
                  room.connection !== "connected" ||
                  room.state?.queue.some((entry) => entry.track.id === track.id)
                }
                onClick={() =>
                  void room.command("/queue", "POST", { trackId: track.id })
                }
              >
                <Plus size={17} />
                Queue
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
