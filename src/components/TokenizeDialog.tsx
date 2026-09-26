"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./TokenizeDialog.module.css";

export default function TokenizeDialog({
  open,
  onClose,
  children,
  wallet,
  tourHost,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wallet: ReactNode;
  tourHost: (element: HTMLDivElement | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const backdropPress = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousOverflow = document.body.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    element.showModal();
    document.body.style.overflow = "hidden";
    title.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="tokenize-dialog-title"
      aria-describedby="tokenize-dialog-description"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button, a[href], input, select, textarea, summary, [tabindex="0"]',
          ),
        ).filter(
          (element) =>
            !element.matches(":disabled") &&
            element.getClientRects().length > 0,
        );
        const first = items[0],
          last = items.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === title.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (backdropPress.current && event.target === event.currentTarget)
          onClose();
        backdropPress.current = false;
      }}
    >
      <div className={styles.surface}>
        <header className={styles.header}>
          <div>
            <h2 id="tokenize-dialog-title" tabIndex={-1} ref={title}>
              Tokenize a space
            </h2>
            <p id="tokenize-dialog-description">
              Define the space, its rights, and the offer.
            </p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close tokenization"
          >
            <X size={20} />
          </button>
        </header>
        <div className={styles.context}>
          <div className={styles.eligibility}>
            <strong>Initial launch: pre-approved companies only</strong>
            <p>
              Registration is open for this demo. No real company or ownership
              checks are performed.
            </p>
          </div>
          {wallet}
        </div>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          Close anytime. Your draft stays here during this visit.
        </footer>
      </div>
      <div ref={tourHost} />
    </dialog>
  );
}
