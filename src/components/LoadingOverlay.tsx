"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle } from "lucide-react";
import styles from "./LoadingOverlay.module.css";

export default function LoadingOverlay({
  active,
  title,
  detail,
}: {
  active: boolean;
  title: string;
  detail?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!active || !mounted) return null;

  // A portal keeps the veil aligned with the viewport even inside a map or panel.
  // Keep navigation and wallet dialogs usable while a network request is pending.
  return createPortal(
    <div
      className={styles.overlay}
      role="status"
      aria-label="Loading progress"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={styles.content}>
        <LoaderCircle className={styles.spinner} size={28} aria-hidden="true" />
        <div>
          <strong>{title}</strong>
          {detail && <p>{detail}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
