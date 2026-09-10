import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Disc3,
  Heart,
  ListMusic,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api, json, message } from "./api";
import { useLibrary } from "./LibraryContext";
import { usePlayer } from "./Player";
import { TrackActions } from "./TrackActions";
import { formatTime, type Track } from "./types";
import type { PlaylistDetail, PlaylistSummary } from "./libraryTypes";

function LibraryHeader({ title }: { title: string }) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        Your collection <ChevronRight size={14} />
        <span>{title}</span>
      </div>
    </header>
  );
}

function PlaylistForm({
  initial,
  submit,
  cancel,
}: {
  initial?: { name: string; description: string };
  submit: (name: string, description: string) => Promise<void>;
  cancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await submit(name, description);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="playlist-form form-stack" onSubmit={save}>
      <h2>{initial ? "Edit playlist" : "A new collection"}</h2>
      <label>
        Playlist name
        <input
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Description <small>(optional)</small>
        <textarea
          maxLength={500}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="button-row">
        <button className="primary-button" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create playlist"}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={cancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function LibraryPage() {
  const [lists, setLists] = useState<PlaylistSummary[]>([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setStatus("loading");
    api<PlaylistSummary[]>("/api/library/playlists")
      .then((value) => {
        if (active) {
          setLists(value);
          setStatus("ready");
        }
      })
      .catch((failure) => {
        if (active) {
          setError(message(failure));
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <>
      <LibraryHeader title="Playlists" />
      <div className="page-content library-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR COLLECTION</p>
            <h1>Your library</h1>
          </div>
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Plus size={17} />
            New playlist
          </button>
        </div>
        <Link className="favorites-banner" to="/favorites">
          <Heart size={28} />
          <div>
            <h2>Favorites</h2>
            <p>All the sounds you've kept close.</p>
          </div>
          <ChevronRight size={22} />
        </Link>
        {creating && (
          <PlaylistForm
            cancel={() => setCreating(false)}
            submit={async (name, description) => {
              const created = await api<PlaylistDetail>(
                "/api/library/playlists",
                json("POST", { name, description }),
              );
              navigate(`/library/${created.id}`);
            }}
          />
        )}
        <div className="section-heading">
          <h2>Made by you</h2>
          <span className="section-kicker">Private playlists</span>
        </div>
        {status === "loading" && <p role="status">Loading your playlists…</p>}
        {status === "error" && (
          <div className="message-state">
            <p role="alert">{error}</p>
            <button
              className="secondary-button"
              onClick={() => setRevision((value) => value + 1)}
            >
              Retry playlists
            </button>
          </div>
        )}
        {status === "ready" &&
          (lists.length ? (
            <div className="playlist-grid">
              {lists.map((list) => (
                <Link
                  className="playlist-card"
                  key={list.id}
                  to={`/library/${list.id}`}
                >
                  <div className="playlist-cover">
                    <ListMusic size={45} />
                    <span>UNISON / PERSONAL COLLECTION</span>
                  </div>
                  <h3>{list.name}</h3>
                  <p>
                    {list.trackCount}{" "}
                    {list.trackCount === 1 ? "track" : "tracks"} · Private
                  </p>
                  {list.description && (
                    <p className="playlist-description">{list.description}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="message-state">
              <ListMusic />
              <h3>Your first playlist starts here.</h3>
              <p>Give it a name, then add sounds from Discover.</p>
              <button
                className="secondary-button"
                onClick={() => setCreating(true)}
              >
                Make a playlist
              </button>
            </div>
          ))}
      </div>
    </>
  );
}

function PlayTrack({ track }: { track: Track }) {
  const player = usePlayer();
  const playing = player.track?.id === track.id && player.playing;
  return (
    <button
      className={`artwork mini ${track.artwork} row-play`}
      aria-label={`${playing ? "Pause" : "Play"} ${track.title}`}
      onClick={() => player.select(track)}
    >
      {playing ? (
        <Pause size={18} fill="currentColor" />
      ) : (
        <Play size={18} fill="currentColor" />
      )}
    </button>
  );
}

export function FavoritesPage() {
  const { favorites, status, reload } = useLibrary();
  return (
    <>
      <LibraryHeader title="Favorites" />
      <div className="page-content library-page">
        <p className="eyebrow">YOUR COLLECTION</p>
        <h1>Favorites</h1>
        <p className="page-description">Your favorites, all in one place.</p>
        {status === "loading" && <p role="status">Loading favorites…</p>}
        {status === "error" && (
          <div className="message-state">
            <p role="alert">We couldn't load your favorites.</p>
            <button className="secondary-button" onClick={reload}>
              Retry favorites
            </button>
          </div>
        )}
        {status === "ready" &&
          (favorites.length ? (
            <div className="library-tracks">
              {favorites.map((track) => (
                <div className="library-track" key={track.id}>
                  <PlayTrack track={track} />
                  <div className="row-title">
                    <h3>{track.title}</h3>
                    <p>{track.artist}</p>
                  </div>
                  <span className="row-duration">
                    {formatTime(track.durationSeconds)}
                  </span>
                  <TrackActions track={track} />
                </div>
              ))}
            </div>
          ) : (
            <div className="message-state">
              <Heart />
              <h3>Nothing saved. Yet.</h3>
              <p>Tap the heart beside a track to keep it here.</p>
              <Link className="primary-button" to="/">
                Explore sounds
              </Link>
            </div>
          ))}
      </div>
    </>
  );
}

export function PlaylistPage() {
  const { id } = useParams();
  return <PlaylistContent key={id} id={id!} />;
}
function PlaylistContent({ id }: { id: string }) {
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revision, setRevision] = useState(0);
  const navigate = useNavigate();
  const endpoint = `/api/library/playlists/${encodeURIComponent(id)}`;
  useEffect(() => {
    let active = true;
    setStatus("loading");
    api<PlaylistDetail>(endpoint)
      .then((value) => {
        if (active) {
          setPlaylist(value);
          setStatus("ready");
        }
      })
      .catch((failure) => {
        if (active) {
          setError(message(failure));
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [endpoint, revision]);
  async function change(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setPlaylist(await api<PlaylistDetail>(endpoint));
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  async function move(index: number, delta: number) {
    const order = playlist!.tracks.map((track) => track.id);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    await change(() =>
      api(`${endpoint}/order`, json("PUT", { trackIds: order })),
    );
  }
  if (status === "loading")
    return (
      <div className="page-content" role="status">
        Loading playlist…
      </div>
    );
  if (status === "error" || !playlist)
    return (
      <div className="page-content message-state">
        <h1>Playlist unavailable.</h1>
        <p role="alert">{error}</p>
        <div className="button-row">
          <button
            className="secondary-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry playlist
          </button>
          <Link className="text-link" to="/library">
            Back to library
          </Link>
        </div>
      </div>
    );
  return (
    <>
      <LibraryHeader title="Playlist" />
      <div className="page-content library-page">
        <Link className="text-link" to="/library">
          ← Your library
        </Link>
        <div className="playlist-heading">
          <div className="playlist-cover">
            <Disc3 size={70} />
          </div>
          <div>
            <p className="eyebrow">YOUR PRIVATE PLAYLIST</p>
            <h1>{playlist.name}</h1>
            <p className="page-description">
              {playlist.description || "A collection made by you."}
            </p>
            <span className="section-kicker">
              {playlist.tracks.length}{" "}
              {playlist.tracks.length === 1 ? "TRACK" : "TRACKS"} ·{" "}
              {formatTime(
                playlist.tracks.reduce(
                  (sum, track) => sum + track.durationSeconds,
                  0,
                ),
              )}
            </span>
          </div>
        </div>
        <div className="button-row playlist-toolbar">
          <Link className="primary-button" to="/">
            <Plus size={17} />
            Add tracks
          </Link>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setEditing(!editing);
              setDeleting(false);
            }}
          >
            <Pencil size={15} />
            Edit playlist
          </button>
          <button
            className="icon-button"
            disabled={busy}
            aria-label="Delete playlist"
            onClick={() => {
              setDeleting(true);
              setEditing(false);
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
        {editing && (
          <PlaylistForm
            initial={playlist}
            cancel={() => setEditing(false)}
            submit={async (name, description) => {
              await api(endpoint, json("PUT", { name, description }));
              setPlaylist(await api<PlaylistDetail>(endpoint));
              setEditing(false);
            }}
          />
        )}
        {deleting && (
          <div className="delete-confirm">
            <h2>Delete “{playlist.name}”?</h2>
            <p>
              This removes the playlist. Your favorites and the catalog will
              stay available.
            </p>
            <div className="button-row">
              <button
                className="danger-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api(endpoint, { method: "DELETE" });
                    navigate("/library");
                  } catch (failure) {
                    setError(message(failure));
                    setBusy(false);
                  }
                }}
              >
                Delete permanently
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => setDeleting(false)}
              >
                Keep playlist
              </button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}{" "}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setRevision((value) => value + 1)}
            >
              Refresh playlist
            </button>
          </p>
        )}
        {playlist.tracks.length ? (
          <div className="library-tracks" aria-busy={busy}>
            {playlist.tracks.map((track, index) => (
              <div
                className="library-track playlist-track"
                key={track.id}
                data-track-id={track.id}
              >
                <PlayTrack track={track} />
                <div className="row-title">
                  <h3>{track.title}</h3>
                  <p>{track.artist}</p>
                </div>
                <span className="row-duration">
                  {formatTime(track.durationSeconds)}
                </span>
                <div className="row-order">
                  <button
                    className="icon-button"
                    disabled={busy || index === 0}
                    aria-label={`Move ${track.title} up`}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy || index === playlist.tracks.length - 1}
                    aria-label={`Move ${track.title} down`}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`Remove ${track.title} from playlist`}
                    onClick={() =>
                      void change(() =>
                        api(`${endpoint}/tracks/${track.id}`, {
                          method: "DELETE",
                        }),
                      )
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="message-state">
            <ListMusic />
            <h3>Room for your next favorite.</h3>
            <p>Find a sound in Discover and choose “Add to playlist”.</p>
            <Link className="text-link" to="/">
              Find a sound →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
