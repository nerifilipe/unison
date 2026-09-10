import { useEffect, type RefObject } from "react";

/** Native dialog traps focus; close it before unmounting to restore the trigger. */
export function useModal(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [ref]);
}
