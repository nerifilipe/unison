import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ListPlus, X } from "lucide-react";
import { api, message } from "./api";
import { useAuth } from "./Auth";
import { useLibrary } from "./LibraryContext";
import type { Track } from "./types";
import type { PlaylistSummary } from "./libraryTypes";

export function TrackActions({ track }: { track: Track }) {
  const { user } = useAuth();
  const { favorites, status, reload, toggle } = useLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const favorite = favorites.some((value) => value.id === track.id);
  if (!user)
    return (
      <Link
        className="save-prompt"
        to="/account?next=discover"
        aria-label={`Sign in to save ${track.title}`}
      >
        <Heart size={16} />
        <span>Save</span>
      </Link>
    );
  return (
    <div className="track-actions">
      <button
        className="icon-button"
        aria-label={`${favorite ? "Remove" : "Save"} ${track.title} ${favorite ? "from" : "to"} favorites`}
        aria-pressed={favorite}
        disabled={busy || status === "loading"}
        onClick={async () => {
          if (status === "error") {
            reload();
            return;
          }
          setBusy(true);
          setError("");
          try {
            await toggle(track);
          } catch (failure) {
            setError(message(failure));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Heart size={17} fill={favorite ? "currentColor" : "none"} />
      </button>
      <button
        className="icon-button"
        aria-label={`Add ${track.title} to playlist`}
        onClick={() => setAdding(true)}
      >
        <ListPlus size={19} />
      </button>
      {status === "error" && (
        <span className="inline-warning">
          Favorites unavailable; tap heart to retry.
        </span>
      )}
      {error && (
        <span className="inline-warning" role="alert">
          {error}
        </span>
      )}
      {adding && <AddToPlaylist track={track} close={() => setAdding(false)} />}
    </div>
  );
}

function AddToPlaylist({ track, close }: { track: Track; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [lists, setLists] = useState<PlaylistSummary[]>([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
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
    <dialog
      ref={ref}
      className="playlist-dialog"
      onCancel={close}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <div className="dialog-title">
        <h2>Add to playlist</h2>
        <button
          className="icon-button"
          aria-label="Close playlist picker"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <p>
        {track.title} · {track.artist}
      </p>
      {status === "loading" && <p role="status">Loading playlists…</p>}
      {status === "error" && (
        <>
          <p role="alert">{error}</p>
          <button
            className="secondary-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Try again
          </button>
        </>
      )}
      {status === "ready" && (
        <>
          {lists.length === 0 ? (
            <p>You haven't made a playlist yet.</p>
          ) : (
            <div className="playlist-options">
              {lists.map((list) => (
                <button
                  key={list.id}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await api(
                        `/api/library/playlists/${list.id}/tracks/${track.id}`,
                        { method: "PUT" },
                      );
                      close();
                    } catch (failure) {
                      setError(message(failure));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {list.name}
                  <small>{list.trackCount} tracks · Private</small>
                </button>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Link className="text-link" to="/library" onClick={close}>
            Create a playlist →
          </Link>
        </>
      )}
    </dialog>
  );
}
