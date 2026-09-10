import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, FileAudio, RefreshCw, Trash2, Upload } from "lucide-react";
import { api, message } from "./api";
import { useLibrary } from "./LibraryContext";

type Job = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  fileName: string;
  fileSize: number;
  status: string;
  error: string | null;
  createdAt: string;
};
const pending = (job: Job) =>
  ["RECEIVING", "QUEUED", "PROCESSING", "DELETING"].includes(job.status);
const labels: Record<string, string> = {
  RECEIVING: "Receiving",
  QUEUED: "Waiting to process",
  PROCESSING: "Processing audio",
  READY: "Published",
  FAILED: "Needs attention",
  DELETING: "Removing files",
};

export function UploadsPage() {
  const { reload } = useLibrary();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const rows = await api<Job[]>("/api/uploads");
        if (!active) return;
        setJobs(rows);
        setStatus("ready");
        if (rows.some(pending)) timer = setTimeout(load, 2000);
      } catch (failure) {
        if (active) {
          setError(message(failure));
          setStatus("error");
        }
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [revision]);
  async function action(job: Job, remove: boolean) {
    setBusyId(job.id);
    setError("");
    try {
      await api(`/api/uploads/${job.id}${remove ? "" : "/retry"}`, {
        method: remove ? "DELETE" : "POST",
      });
      if (remove) reload();
      setConfirmId(null);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusyId(null);
    }
  }
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          Your studio <span>Upload audio</span>
        </div>
        <span className="demo-tag">MAKE YOURSELF HEARD</span>
      </header>
      <div className="page-content uploads-page">
        <p className="eyebrow">EVERY SOUND STARTS SOMEWHERE.</p>
        <h1>Share a little of your world.</h1>
        <p className="page-description">
          Bring your own music to Unison. Finished tracks appear in the public
          catalog.
        </p>
        <UploadForm
          submitted={() => {
            setError("");
            setRevision((value) => value + 1);
          }}
        />
        <section className="upload-history" aria-labelledby="uploads-title">
          <div className="section-heading">
            <h2 id="uploads-title">Your uploads</h2>
            <button
              className="secondary-button"
              onClick={() => {
                setError("");
                setRevision((value) => value + 1);
              }}
            >
              <RefreshCw size={15} />
              Refresh uploads
            </button>
          </div>
          {status === "loading" && <p role="status">Loading your uploads…</p>}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {status === "ready" && jobs.length === 0 && (
            <div className="message-state">
              <FileAudio />
              <h3>Your first release starts here.</h3>
              <p>
                Upload an original recording or audio you have permission to
                distribute.
              </p>
            </div>
          )}
          <div className="upload-jobs" aria-live="polite">
            {jobs.map((job) => (
              <article className="upload-job" key={job.id}>
                <div className="upload-job-icon">
                  <FileAudio size={25} />
                </div>
                <div className="upload-job-body">
                  <h3>{job.title}</h3>
                  <p>
                    {job.artist} · {job.fileName} ·{" "}
                    {(job.fileSize / 1048576).toFixed(1)} MiB
                  </p>
                  <span
                    className={`job-status status-${job.status.toLowerCase()}`}
                  >
                    {job.status === "READY" && <Check size={13} />}{" "}
                    {labels[job.status]}
                  </span>
                  {job.error && <p className="job-error">{job.error}</p>}
                  {job.status === "READY" && (
                    <Link
                      className="text-link"
                      to={`/?q=${encodeURIComponent(job.title)}`}
                    >
                      Find in Discover →
                    </Link>
                  )}
                  {confirmId === job.id && (
                    <div className="remove-upload-confirm">
                      <p>
                        Remove this upload and its catalog track? It will also
                        leave any favorites and playlists.
                      </p>
                      <div className="button-row">
                        <button
                          className="danger-button"
                          disabled={busyId !== null}
                          onClick={() => void action(job, true)}
                        >
                          Remove permanently
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => setConfirmId(null)}
                        >
                          Keep upload
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="upload-job-actions">
                  {job.status === "FAILED" && (
                    <button
                      className="secondary-button"
                      disabled={busyId !== null}
                      onClick={() => void action(job, false)}
                    >
                      Retry processing
                    </button>
                  )}
                  {["READY", "FAILED", "QUEUED"].includes(job.status) && (
                    <button
                      className="icon-button"
                      disabled={busyId !== null}
                      aria-label={`Remove upload ${job.title}`}
                      onClick={() => setConfirmId(job.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function UploadForm({ submitted }: { submitted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("Ambient");
  const [rights, setRights] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  async function send(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (
      !file ||
      !file.size ||
      file.size > 25 * 1024 * 1024 ||
      !/\.(wav|mp3|flac|ogg)$/i.test(file.name)
    ) {
      setError("Choose a non-empty WAV, MP3, FLAC or OGG file up to 25 MiB.");
      return;
    }
    const data = new FormData();
    data.append(
      "metadata",
      new Blob(
        [
          JSON.stringify({
            title,
            artist,
            genre,
            rightsConfirmed: rights,
            rightsNote: note,
          }),
        ],
        { type: "application/json" },
      ),
    );
    data.append("audio", file);
    setBusy(true);
    try {
      await api<Job>("/api/uploads", {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(120000),
      });
      setSuccess("Upload received. Follow its progress below.");
      setFile(null);
      setTitle("");
      setRights(false);
      setNote("");
      if (fileInput.current) fileInput.current.value = "";
      submitted();
    } catch (failure) {
      setError(message(failure));
      submitted();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="upload-form form-stack" onSubmit={send}>
      <label className="audio-file-label">
        <Upload size={29} />
        <strong>Choose your audio</strong>
        <span>WAV, MP3, FLAC or OGG · up to 25 MiB · 1 second–10 minutes</span>
        <input
          ref={fileInput}
          aria-label="Audio file"
          type="file"
          accept=".wav,.mp3,.flac,.ogg"
          required
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setSuccess("");
          }}
        />
      </label>
      <div className="upload-fields">
        <label>
          Track title
          <input
            required
            maxLength={120}
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Artist name
          <input
            required
            maxLength={120}
            value={artist}
            disabled={busy}
            onChange={(e) => setArtist(e.target.value)}
          />
        </label>
        <label>
          Genre
          <select
            value={genre}
            disabled={busy}
            onChange={(e) => setGenre(e.target.value)}
          >
            {["Ambient", "Electronic", "Downtempo", "Acoustic", "Other"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
      </div>
      <label>
        Audio source and permission
        <textarea
          required
          maxLength={500}
          rows={2}
          placeholder="For example: an original piece I composed and recorded, or the source and license allowing redistribution."
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label className="rights-checkbox">
        <input
          type="checkbox"
          required
          checked={rights}
          disabled={busy}
          onChange={(e) => setRights(e.target.checked)}
        />
        <span>
          I created this audio or have permission to distribute it publicly on
          Unison.
        </span>
      </label>
      <p className="form-note">
        Audio-only files, without embedded video or cover-art streams. We'll
        validate and convert your file before publishing it. Files that fail
        validation stay private.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {success && (
        <p className="upload-success" role="status">
          <Check size={16} />
          {success}
        </p>
      )}
      <button className="primary-button" disabled={busy || !rights}>
        <Upload size={17} />
        {busy ? "Uploading audio…" : "Upload and process"}
      </button>
    </form>
  );
}
