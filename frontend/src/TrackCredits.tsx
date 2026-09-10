import { useId, useRef, useState } from "react";
import { useModal } from "./useModal";
import { Info, X } from "lucide-react";
import type { Track } from "./types";

export function TrackCredits({ track }: { track: Track }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="icon-button"
        aria-label={`Credits for ${track.title}`}
        onClick={() => setOpen(true)}
      >
        <Info size={16} />
      </button>
      {open && <CreditsDialog track={track} close={() => setOpen(false)} />}
    </>
  );
}
function CreditsDialog({ track, close }: { track: Track; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useModal(dialog);
  return (
    <dialog
      ref={dialog}
      className="playlist-dialog"
      aria-labelledby={titleId}
      onCancel={close}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <div className="dialog-title">
        <h2 id={titleId}>Track credits</h2>
        <button
          className="icon-button"
          aria-label="Close credits"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <p>
        {track.title} · {track.artist}
      </p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {track.publicCredits ||
          "The uploader has not supplied public credits yet."}
      </p>
    </dialog>
  );
}
