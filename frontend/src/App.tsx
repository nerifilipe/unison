import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  Disc3,
  Headphones,
  Info,
  Music2,
  Pause,
  Play,
  Radio,
  Search,
  Waves,
} from "lucide-react";
import { usePlayer } from "./Player";
import { formatTime, type Track } from "./types";

function Discover() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const { track: current, playing, select } = usePlayer();
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    setStatus("loading");
    fetch("/api/tracks", { signal: controller.signal })
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
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  const visible = tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.genre}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          Explore <ChevronRight size={14} />
          <span>Discover</span>
        </div>
        <span className="demo-tag">
          <span /> LOCAL DEMO
        </span>
      </header>
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">A LITTLE LESS NOISE. A LITTLE MORE MUSIC.</p>
            <h1>Find your frequency.</h1>
          </div>
          <span className="edition">
            THE UNISON SESSIONS <span>VOL. 001 — 2026</span>
          </span>
        </div>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="pill">
              <span /> THE FIRST SESSION
            </span>
            <h2 id="hero-title">
              Good things
              <br />
              start with a listen.
            </h2>
            <p>
              Step out of the everyday. Ease into a collection
              <br className="desktop-break" /> of sounds made for a slower
              moment.
            </p>
            <button
              className="primary-button"
              disabled={!tracks.length || status !== "ready"}
              onClick={() => select(tracks[0])}
            >
              {current?.id === tracks[0]?.id && playing ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}{" "}
              {current?.id === tracks[0]?.id && playing
                ? "Pause session"
                : "Start listening"}
            </button>
            <span className="hero-caption">
              3 ORIGINAL SOUNDS <span> / </span> NO DISTRACTIONS
            </span>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbital-ring ring-one" />
            <div className="orbital-ring ring-two" />
            <div className="sun" />
            <span className="art-coordinates">38°43′ N &nbsp; 9°08′ W</span>
            <span className="art-label">
              SOUND
              <br />
              WITHOUT
              <br />
              BOUNDARIES.
            </span>
            <div className="art-bottom">
              <span>UNISON®</span>
              <AudioLines size={30} />
            </div>
          </div>
        </section>
        <section className="catalog" aria-labelledby="catalog-title">
          <div className="section-heading">
            <div>
              <div className="section-kicker">
                CURATED FOR YOUR FIRST LISTEN
              </div>
              <h2 id="catalog-title">
                Fresh frequencies
                <span>
                  {status === "ready"
                    ? String(tracks.length).padStart(2, "0")
                    : "—"}
                </span>
              </h2>
            </div>
            <label className="search">
              <Search size={17} />
              <input
                type="search"
                aria-label="Search catalog"
                placeholder="Find a sound…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          {status === "loading" && (
            <div className="loading-state" role="status">
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
              <p>Finding your frequencies…</p>
            </div>
          )}
          {status === "error" && (
            <div className="message-state" role="alert">
              <Radio />
              <h3>We couldn't reach the catalog.</h3>
              <p>Check that the local services are running, then try again.</p>
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
                {tracks.length ? "No sounds found." : "The catalog is quiet."}
              </h3>
              <p>
                {tracks.length
                  ? "Try another title, artist or genre."
                  : "Add the demo seed and come back for a listen."}
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
              {visible.map((track, index) => (
                <article className="track-card" key={track.id}>
                  <button
                    className={`artwork ${track.artwork} track-art`}
                    aria-label={`${current?.id === track.id && playing ? "Pause" : "Play"} ${track.title}`}
                    onClick={() => select(track)}
                  >
                    <span className="cover-top">
                      UNISON LAB <span>0{index + 1}</span>
                    </span>
                    <span className="cover-title">{track.title}</span>
                    <span className="cover-bottom">
                      ORIGINAL SESSIONS{" "}
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
                  <span className="genre">{track.genre}</span>
                </article>
              ))}
            </div>
          )}
        </section>
        <div className="bottom-note">
          <span>
            <Check size={15} /> Original audio. Open to explore.
          </span>
          <NavLink to="/about">
            Meet Unison <ArrowUpRight size={16} />
          </NavLink>
        </div>
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
          <span>About the project</span>
        </div>
        <span className="demo-tag">
          <span /> LOCAL DEMO
        </span>
      </header>
      <div className="page-content about-page">
        <p className="eyebrow">BUILT WITH CURIOSITY. MADE FOR LISTENING.</p>
        <h1>A shared love of sound.</h1>
        <p className="about-intro">
          Unison is a music playground and a Computer Engineering portfolio
          project. A place to explore how thoughtful interfaces and reliable
          systems come together.
        </p>
        <div className="about-highlight">
          <Headphones size={32} />
          <div>
            <h2>Keep the music going.</h2>
            <p>
              Your player stays with you as you move between pages. Pick a track
              in Discover, then come back here. Same sound, uninterrupted.
            </p>
          </div>
        </div>
        <div className="about-grid">
          <section>
            <span className="section-kicker">01 / THE SOUND</span>
            <h2>Original by design</h2>
            <p>
              These three one-minute demos are synthetic ambient chords,
              generated with FFmpeg from mathematical signals. No commercial
              recordings, samples or third-party performances are used.
            </p>
          </section>
          <section>
            <span className="section-kicker">02 / THE FOUNDATION</span>
            <h2>Small beginning. Clear direction.</h2>
            <p>
              A React interface, a modular Spring Boot API, PostgreSQL metadata
              and S3-compatible audio storage. Accounts, playlists and
              synchronized listening rooms will follow in later milestones.
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
        <p className="nav-caption">YOUR SPACE FOR SOUND</p>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <Disc3 size={19} />
            Discover
          </NavLink>
          <NavLink to="/about">
            <Info size={19} />
            About Unison
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-symbol">
            <Waves size={30} />
          </div>
          <h3>
            Better with your
            <br />
            headphones on.
          </h3>
          <p>
            A little space to get
            <br />
            lost in sound.
          </p>
          <ArrowDown size={19} />
          <span className="build-label">THE BEGINNING · V0.1</span>
        </div>
      </aside>
      <main id="main">
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/about" element={<About />} />
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
