"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./PitchPresenter.module.css";

export default function PitchPresenter() {
  const [slide, setSlide] = useState(0);
  const [view, setView] = useState<"slides" | "demo" | "architecture">("slides");
  const [controls, setControls] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const architecture = useRef<HTMLIFrameElement>(null);
  const removeFrameKeys = useRef<(() => void) | null>(null);
  const removeArchitectureKeys = useRef<(() => void) | null>(null);
  const state = useRef({ slide, view });
  state.current = { slide, view };
  const keyboard = useCallback((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) return;
    const target = e.target as HTMLElement | null;
    const editing = target?.closest?.(
      "input, textarea, select, [contenteditable=true]",
    );
    const key = e.key.toLowerCase();
    if (e.altKey && ["1", "2", "3"].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      setView(key === "1" ? "slides" : key === "2" ? "demo" : "architecture");
      return;
    }
    if (editing || e.altKey) return;
    if (["s", "d", "a", "h"].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      if (key === "s") setView("slides");
      if (key === "d") setView("demo");
      if (key === "a") setView("architecture");
      if (key === "h") setControls((v) => !v);
    } else if (
      state.current.view === "slides" &&
      ["ArrowRight", "ArrowLeft", " "].includes(e.key)
    ) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "ArrowLeft") setSlide((v) => Math.max(0, v - 1));
      else if (state.current.slide === 4) setView("demo");
      else setSlide((v) => Math.min(4, v + 1));
    }
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", keyboard, true);
    // Static slides may finish loading before React re-runs effects in development.
    // Reattach here as well as onLoad so frame shortcuts survive effect cleanup.
    attachFrameKeys();
    attachArchitectureKeys();
    return () => {
      window.removeEventListener("keydown", keyboard, true);
      removeFrameKeys.current?.();
      removeArchitectureKeys.current?.();
    };
  }, [keyboard]);
  useEffect(() => {
    if (view === "demo") frame.current?.focus();
    else frame.current?.blur();
    if (view === "architecture") architecture.current?.focus();
    else architecture.current?.blur();
    architecture.current?.contentWindow?.postMessage(
      { type: "pitch-visibility", visible: view === "architecture" },
      window.location.origin,
    );
  }, [view]);
  const attachFrameKeys = () => {
    removeFrameKeys.current?.();
    const doc = frame.current?.contentDocument;
    doc?.addEventListener("keydown", keyboard, true);
    removeFrameKeys.current = () =>
      doc?.removeEventListener("keydown", keyboard, true);
  };
  const attachArchitectureKeys = () => {
    removeArchitectureKeys.current?.();
    const doc = architecture.current?.contentDocument;
    doc?.addEventListener("keydown", keyboard, true);
    removeArchitectureKeys.current = () =>
      doc?.removeEventListener("keydown", keyboard, true);
    architecture.current?.contentWindow?.postMessage(
      { type: "pitch-visibility", visible: state.current.view === "architecture" },
      window.location.origin,
    );
  };
  return (
    <main className={styles.stage} aria-label="Finalist presentation">
      <div
        className={styles.slides}
        hidden={view !== "slides"}
        aria-label="Opening slides"
      >
        {[1, 2, 3, 4, 5].map((n, i) => (
          <img
            key={n}
            src={`/pitch/intro/slide-${n}.png`}
            alt={
              [
                "Tokyo's vacant homes",
                "Unused rooftops and solar potential",
                "Assets missing from investment listings",
                "So we built Tokenize Tokyo",
                "How it fits together: app, MultiBaas, contracts, ENS",
              ][i]
            }
            hidden={slide !== i}
            draggable={false}
          />
        ))}
      </div>
      <iframe
        ref={architecture}
        title="Tokenize Tokyo architecture"
        src="/pitch/architecture/index.html"
        onLoad={attachArchitectureKeys}
        className={styles.demo}
        data-visible={view === "architecture"}
        aria-hidden={view !== "architecture"}
        tabIndex={view === "architecture" ? 0 : -1}
      />
      <iframe
        ref={frame}
        title="Guided Tokenize Tokyo demo"
        src="/demo?pitch=1"
        onLoad={attachFrameKeys}
        className={styles.demo}
        data-visible={view === "demo"}
        aria-hidden={view !== "demo"}
        tabIndex={view === "demo" ? 0 : -1}
      />
      <nav
        className={styles.controls}
        aria-label="Presentation controls"
        hidden={!controls}
      >
        <button onClick={() => setView("slides")}>Slides · S</button>
        <button onClick={() => setView("demo")}>Demo · D</button>
        <button onClick={() => setView("architecture")}>Architecture · A</button>
        <button
          disabled={slide === 0}
          onClick={() => {
            setView("slides");
            setSlide((v) => Math.max(0, v - 1));
          }}
        >
          ←
        </button>
        <button
          onClick={() => {
            if (slide === 4) setView("demo");
            else {
              setView("slides");
              setSlide((v) => v + 1);
            }
          }}
        >
          →
        </button>
        <button
          onClick={() => {
            void document.documentElement.requestFullscreen?.();
          }}
        >
          Full screen
        </button>
        <button onClick={() => setControls(false)}>Hide · H</button>
      </nav>
    </main>
  );
}
