"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { RefreshCw } from "lucide-react";
import type { ShowcaseCity } from "@/lib/cities";
import styles from "./CityShowcase.module.css";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export default function CityShowcaseMap({
  city,
  cameraReset,
}: {
  city: ShowcaseCity;
  cameraReset: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const latestCity = useRef(city);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  latestCity.current = city;

  useEffect(() => {
    if (!container.current) return;
    setStatus("loading");
    let map: maplibregl.Map;
    let timeout: ReturnType<typeof setTimeout>;
    try {
      const initial = latestCity.current;
      map = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        center: [...initial.coordinates],
        zoom: initial.zoom,
        pitch: 60,
        bearing: initial.bearing,
        attributionControl: { compact: true },
        // Prevent incidental wheel scrolling while presenting the page.
        scrollZoom: false,
      });
      mapRef.current = map;
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        "top-right",
      );
      map.on("style.load", () => {
        if (map.getSource("openmaptiles")) {
          map.addLayer({
            id: "showcase-buildings",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 13,
            paint: {
              "fill-extrusion-color": "#69726b",
              "fill-extrusion-height": [
                "coalesce",
                ["get", "render_height"],
                8,
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["get", "render_min_height"],
                0,
              ],
              "fill-extrusion-opacity": 0.85,
            },
          });
        }
      });
      map.on("idle", () => {
        if (map.isStyleLoaded() && map.areTilesLoaded()) {
          clearTimeout(timeout);
          setStatus("ready");
        }
      });
      map.on("error", () => {
        if (!map.isStyleLoaded()) setStatus("error");
      });
      map.on("movestart", () => {
        clearTimeout(timeout);
        setStatus("loading");
        timeout = setTimeout(() => setStatus("error"), 20000);
      });
      timeout = setTimeout(() => setStatus("error"), 20000);
    } catch {
      setStatus("error");
      return;
    }
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      mapRef.current = null;
      map.remove();
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // stop() also cancels an earlier flight when presenters switch cities quickly.
    map.stop();
    map.flyTo({
      center: [...city.coordinates],
      zoom: city.zoom,
      pitch: 60,
      bearing: city.bearing,
      duration: reducedMotion ? 0 : 2400,
      essential: false,
    });
  }, [city, cameraReset, attempt]);

  return (
    <div
      className={styles.map}
      aria-label={`Interactive map of ${city.name}`}
      data-map-status={status}
    >
      <div ref={container} className={styles.mapCanvas} />
      {status !== "ready" && (
        <div className={styles.mapNotice} role="status">
          {status === "loading" ? (
            <>Loading city map…</>
          ) : (
            <>
              <strong>Map unavailable</strong>
              <span>Check your connection and try again.</span>
              <button onClick={() => setAttempt((value) => value + 1)}>
                <RefreshCw size={14} /> Retry map
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
