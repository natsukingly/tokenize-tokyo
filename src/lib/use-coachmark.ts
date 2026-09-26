"use client";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

type Placement = { left: number; top: number; width: number; arrow: string };
export function useCoachmark(
  visible: boolean,
  chooseTarget: () => HTMLElement | null,
  panel: RefObject<HTMLElement | null>,
  container?: HTMLElement | null,
  revision = "",
) {
  const targetPicker = useRef(chooseTarget);
  targetPicker.current = chooseTarget;
  const [position, setPosition] = useState<Placement>({
    left: 24,
    top: 100,
    width: 300,
    arrow: "",
  });
  useLayoutEffect(() => {
    if (!visible) return;
    let previous: HTMLElement | null = null;
    let frame = 0;
    const update = () => {
      frame = 0;
      const target = targetPicker.current();
      if (previous !== target) {
        previous?.classList.remove("guide-target");
        target?.classList.add("guide-target");
        previous = target;
        const bounds = target?.getBoundingClientRect();
        if (bounds && (bounds.bottom > innerHeight - 40 || bounds.top < 70))
          target?.scrollIntoView({ block: "nearest" });
      }
      const rect = target?.getBoundingClientRect();
      const modal = container?.closest("dialog")?.getBoundingClientRect();
      let width = Math.min(300, innerWidth - 28);
      const height = panel.current?.offsetHeight || 210;
      let left = innerWidth - width - 20;
      let top = 96;
      if (rect) {
        if (modal && innerWidth - modal.right > 230) {
          width = Math.min(300, innerWidth - modal.right - 28);
          left = modal.right + 14;
          top = rect.top;
        } else if (rect.right + width + 30 < innerWidth) {
          left = rect.right + 22;
          top = rect.top;
        } else if (rect.left > width + 30) {
          left = rect.left - width - 22;
          top = rect.top;
        } else {
          left = (innerWidth - width) / 2;
          top =
            rect.top > innerHeight / 2
              ? rect.top - height - 24
              : rect.bottom + 24;
        }
      }
      left = Math.max(14, Math.min(left, innerWidth - width - 14));
      top = Math.max(86, Math.min(top, innerHeight - height - 76));
      if (
        modal &&
        innerWidth <= 600 &&
        container?.closest('[data-tour-surface="wallet"]')
      ) {
        left = 14;
        width = innerWidth - 28;
        top = Math.max(14, innerHeight - height - 14);
      }
      let arrow = "";
      if (rect && rect.width && rect.height) {
        let x1 = left + width / 2,
          y1 = top + height / 2;
        let x2 = rect.left + rect.width / 2,
          y2 = rect.top + rect.height / 2;
        if (left >= rect.right) {
          x1 = left - 3;
          x2 = rect.right + 7;
        } else if (left + width <= rect.left) {
          x1 = left + width + 3;
          x2 = rect.left - 7;
        } else if (top >= rect.bottom) {
          y1 = top - 3;
          y2 = rect.bottom + 7;
        } else if (top + height <= rect.top) {
          y1 = top + height + 3;
          y2 = rect.top - 7;
        } else {
          y1 = 0;
        } // Do not draw through overlapping controls on tiny viewports.
        if (y1) arrow = `M${x1},${y1} Q${(x1 + x2) / 2},${y1} ${x2},${y2}`;
      }
      const next = { left, top, width, arrow };
      setPosition((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize = new ResizeObserver(schedule);
    if (panel.current) resize.observe(panel.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    document.addEventListener("input", schedule, true);
    document.addEventListener("change", schedule, true);
    document.addEventListener("toggle", schedule, true);
    update();
    return () => {
      cancelAnimationFrame(frame);
      previous?.classList.remove("guide-target");
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("input", schedule, true);
      document.removeEventListener("change", schedule, true);
      document.removeEventListener("toggle", schedule, true);
    };
  }, [visible, container, panel, revision]);
  return position;
}
