"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ListFilter, Layers3, ChevronDown, Sparkles } from "lucide-react";
import styles from "./MapControls.module.css";

export default function MapControls({
  filters,
  tools,
  filterLabel,
  toolLabel,
  funding,
}: {
  filters: ReactNode;
  tools: ReactNode;
  filterLabel: string;
  toolLabel: string;
  funding?: {
    count: number;
    active: boolean;
    loading: boolean;
    onToggle: () => void;
    content: ReactNode;
  };
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = () =>
      root.current
        ?.querySelectorAll("details[open]")
        .forEach((item) => item.removeAttribute("open"));
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active =
        root.current?.querySelector<HTMLDetailsElement>("details[open]");
      if (active) {
        close();
        active.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <div className={styles.controls} ref={root} aria-label="Map controls">
      {funding && (
        <button
          className={styles.funding}
          aria-pressed={funding.active}
          disabled={funding.loading}
          onClick={() => {
            root.current
              ?.querySelectorAll("details[open]")
              .forEach((el) => el.removeAttribute("open"));
            funding.onToggle();
          }}
        >
          Funding open <b>{funding.loading ? "…" : funding.count}</b>
        </button>
      )}
      {[
        ...(funding
          ? [
              {
                name: "Project picks",
                icon: Sparkles,
                label: "Funding projects",
                content: funding.content,
              },
            ]
          : []),
        {
          name: "Filters",
          icon: ListFilter,
          label: filterLabel,
          content: filters,
        },
        { name: "Map tools", icon: Layers3, label: toolLabel, content: tools },
      ].map(({ name, icon: Icon, label, content }) => (
        <details
          key={name}
          onToggle={(event) => {
            if (event.currentTarget.open)
              root.current
                ?.querySelectorAll("details[open]")
                .forEach((item) => {
                  if (item !== event.currentTarget)
                    item.removeAttribute("open");
                });
          }}
        >
          <summary
            aria-label={name}
            title={label || name}
            data-filtered={name === "Filters" && !!label ? "true" : undefined}
          >
            <Icon size={15} />
            <span>{name}</span>
            <ChevronDown size={12} />
          </summary>
          <div
            className={styles.panel}
            onClick={(event) => {
              if (
                name === "Project picks" &&
                (event.target as HTMLElement).closest("button")
              )
                event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <div className={styles.content}>
              <p className={styles.label}>
                {label ||
                  (name === "Filters"
                    ? "All spaces · All stages"
                    : "Choose how to explore the city")}
              </p>
              {content}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
