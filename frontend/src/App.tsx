import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  Disc3,
  Headphones,
  Info,
  Music2,
  Pause,
  Play,
  Radio,
  Search,
  Heart,
  Library,
  Upload,
} from "lucide-react";
import { usePlayer } from "./Player";
import { formatTime, type Track } from "./types";
import { AccountGate, AccountMenu, AccountPage } from "./Auth";
import { FavoritesPage, LibraryPage, PlaylistPage } from "./LibraryPages";
import { TrackActions } from "./TrackActions";
import { UploadsPage } from "./Uploads";
import { RoomsPage } from "./Rooms";

function Discover() {
  const [params] = useSearchParams();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const { track: current, playing, select } = usePlayer();
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    setStatus("loading");
    const debounce = setTimeout(() => {
      fetch(
        `/api/tracks${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
        { signal: controller.signal },
      )
        .then((response) => {
          if (!response.ok) throw new Error("Catalog unavailable");
          return response.json();
        })
        .then((data: Track[]) => {
          if (active) {
            setTracks(data);
            setStatus("ready");
          }
        })
        .catch(() => {
          if (active) setStatus("error");
        })
        .finally(() => clearTimeout(timeout));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
      clearTimeout(debounce);
      controller.abort();
    };
  }, [attempt, query]);
  const visible = tracks;
  const featured = tracks.at(-1);
  return (
    <>
      <header className="topbar discover-topbar">
        <div className="breadcrumb">
          <span>Discover</span>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            type="search"
            maxLength={120}
            aria-label="Search catalog"
            placeholder="Search songs, artists or genres"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR DAILY SOUNDTRACK</p>
            <h1>Music, at your pace.</h1>
          </div>
          <NavLink className="subtle-link" to="/library">
            Your collection <ArrowUpRight size={16} />
          </NavLink>
        </div>
        {!query.trim() && (
          <section className="discovery-feature" aria-label="Featured track">
            <div className="feature-copy">
              <span className="feature-label">
                <AudioLines size={16} /> In the spotlight
              </span>
              <h2>
                {status === "ready"
                  ? (featured?.title ?? "Make room for music.")
                  : "A new listening moment."}
              </h2>
              <p>
                {status === "ready" && featured
                  ? featured.artist
                  : "Explore the catalog and find something that stays with you."}
              </p>
              {featured && status === "ready" && (
                <span className="feature-meta">
                  {featured.genre} <span>·</span>{" "}
                  {formatTime(featured.durationSeconds)}
                </span>
              )}
              <button
                className="primary-button"
                disabled={!featured || status !== "ready"}
                onClick={() => featured && select(featured)}
              >
                {current?.id === featured?.id && playing ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
                {current?.id === featured?.id && playing
                  ? "Pause session"
                  : "Start listening"}
              </button>
            </div>
            <div
              className={`feature-record artwork ${featured?.artwork ?? "orbit"}`}
              aria-hidden="true"
            >
              <div className="record-disc">
                <span>
                  <AudioLines size={28} />
                </span>
              </div>
            </div>
          </section>
        )}
        <section className="catalog" aria-labelledby="catalog-title">
          <div className="section-heading">
            <div>
              <div className="section-kicker">THE CATALOG</div>
              <h2 id="catalog-title">
                {query.trim() ? "Search results" : "All tracks"}
                <span>
                  {status === "ready"
                    ? String(tracks.length).padStart(2, "0")
                    : "—"}
                </span>
              </h2>
            </div>
          </div>
          {status === "loading" && (
            <div className="loading-state" role="status">
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
              <p>Loading tracks…</p>
            </div>
          )}
          {status === "error" && (
            <div className="message-state" role="alert">
              <Radio />
              <h3>We couldn't reach the catalog.</h3>
              <p>Please try again in a moment.</p>
              <button
                className="secondary-button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {status === "ready" && visible.length === 0 && (
            <div className="message-state">
              <Music2 />
              <h3>
                {query.trim() ? "No sounds found." : "The catalog is quiet."}
              </h3>
              <p>
                {query.trim()
                  ? "Try another title, artist or genre."
                  : "New music will appear here when it is published."}
              </p>
              {query && (
                <button
                  className="secondary-button"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </button>
              )}
            </div>
          )}
          {status === "ready" && (
            <div className="track-grid">
              {visible.map((track) => (
                <article className="track-card" key={track.id}>
                  <button
                    className={`artwork ${track.artwork} track-art`}
                    aria-label={`${current?.id === track.id && playing ? "Pause" : "Play"} ${track.title}`}
                    onClick={() => select(track)}
                  >
                    <span className="cover-top">{track.artist}</span>
                    <span className="cover-title">{track.title}</span>
                    <span className="cover-bottom">
                      {track.genre}
                      <span className="card-play">
                        {current?.id === track.id && playing ? (
                          <Pause size={20} fill="currentColor" />
                        ) : (
                          <Play size={20} fill="currentColor" />
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="track-details">
                    <div>
                      <h3>
                        {track.title}
                        {current?.id === track.id && playing && (
                          <AudioLines size={16} className="active-wave" />
                        )}
                      </h3>
                      <p>{track.artist}</p>
                    </div>
                    <span>{formatTime(track.durationSeconds)}</span>
                  </div>
                  <div className="track-extras">
                    <span className="genre">{track.genre}</span>
                    <TrackActions track={track} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <NavLink className="listen-together" to="/rooms">
          <span className="together-icon">
            <Radio size={24} />
          </span>
          <span>
            <strong>Good music. Better together.</strong>
            <span>Start a room, share the queue and listen in sync.</span>
          </span>
          <ArrowUpRight size={22} />
        </NavLink>
      </div>
    </>
  );
}

function About() {
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          Unison <ChevronRight size={14} />
          <span>About Unison</span>
        </div>
      </header>
      <div className="page-content about-page">
        <p className="eyebrow">ABOUT UNISON</p>
        <h1>A shared love of sound.</h1>
        <p className="about-intro">
          Discover music, build a collection that feels like you, and share the
          listening experience with friends.
        </p>
        <div className="about-highlight">
          <Headphones size={32} />
          <div>
            <h2>Keep the music going.</h2>
            <p>
              Browse the catalog, organize a playlist or explore your library
              while your music keeps playing.
            </p>
          </div>
        </div>
        <div className="about-grid">
          <section>
            <span className="section-kicker">YOUR COLLECTION</span>
            <h2>Keep what you love</h2>
            <p>
              Save your favorites and make private playlists for every mood.
              Upload music you have permission to share and give its creators
              credit.
            </p>
          </section>
          <section>
            <span className="section-kicker">LISTEN TOGETHER</span>
            <h2>A shared listening space</h2>
            <p>
              Invite friends to a room and listen to the same song at the same
              time. Add tracks to the shared queue and vote for what plays next.
            </p>
          </section>
        </div>
        <NavLink className="primary-button" to="/">
          Back to Discover <ArrowUpRight size={16} />
        </NavLink>
      </div>
    </>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="Unison home">
          <AudioLines size={29} strokeWidth={2.7} />
          <span>
            unison<span className="brand-dot">.</span>
          </span>
        </NavLink>
        <p className="nav-caption">BROWSE</p>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <Disc3 size={19} />
            Discover
          </NavLink>
          <NavLink to="/favorites">
            <Heart size={19} />
            Favorites
          </NavLink>
          <NavLink to="/library">
            <Library size={19} />
            Your library
          </NavLink>
          <NavLink to="/rooms">
            <Radio size={19} />
            Listening rooms
          </NavLink>
          <NavLink to="/uploads">
            <Upload size={19} />
            Upload audio
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <NavLink className="about-link" to="/about">
            <Info size={17} />
            About Unison
          </NavLink>
          <AccountMenu />
        </div>
      </aside>
      <main id="main">
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/about" element={<About />} />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="/rooms"
            element={
              <AccountGate>
                <RoomsPage />
              </AccountGate>
            }
          />
          <Route
            path="/rooms/:id"
            element={
              <AccountGate>
                <RoomsPage />
              </AccountGate>
            }
          />
          <Route
            path="/uploads"
            element={
              <AccountGate>
                <UploadsPage />
              </AccountGate>
            }
          />
          <Route
            path="/favorites"
            element={
              <AccountGate>
                <FavoritesPage />
              </AccountGate>
            }
          />
          <Route
            path="/library"
            element={
              <AccountGate>
                <LibraryPage />
              </AccountGate>
            }
          />
          <Route
            path="/library/:id"
            element={
              <AccountGate>
                <PlaylistPage />
              </AccountGate>
            }
          />
          <Route
            path="*"
            element={
              <div className="page-content">
                <h1>Off the record.</h1>
                <p>This page doesn't exist.</p>
                <NavLink to="/">Back to Discover</NavLink>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
