"use client";
import { useEffect, useState } from "react";

export type VisualTheme = "original" | "cyberpunk";
export function useTheme() {
  const [theme, setTheme] = useState<VisualTheme>("cyberpunk");
  useEffect(() => {
    // Keep the old design available through an explicit development preview URL.
    // Normal visits always use the main theme, including browsers with old preferences.
    const preview = new URLSearchParams(window.location.search).get("theme");
    setTheme(preview === "original" ? "original" : "cyberpunk");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return { theme };
}
