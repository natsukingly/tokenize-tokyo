"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import AssetIcon from "./AssetIcon";
import type { AssetKind } from "@/lib/catalog";
import styles from "./MapThumbnail.module.css";

// Keep completed previews as images, so a list does not retain a WebGL map per row.
const previews = new Map<string, string>();
export default function MapThumbnail({
  coordinates,
  kind,
  compact = false,
}: {
  coordinates?: [number, number];
  kind: AssetKind;
  compact?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const longitude = coordinates?.[0],
    latitude = coordinates?.[1];
  useEffect(() => {
    setPreview("");
    setUnavailable(false);
    if (!host.current || longitude === undefined || latitude === undefined)
      return;
    const key = `${longitude},${latitude}`;
    const cached = previews.get(key);
    if (cached) {
      setPreview(cached);
      return;
    }
    let map: maplibregl.Map | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const release = () => {
      clearTimeout(timeout);
      map?.remove();
      map = undefined;
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || disposed) return;
        observer.disconnect();
        try {
          maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
          map = new maplibregl.Map({
            container: host.current!,
            style: "https://tiles.openfreemap.org/styles/dark",
            center: [longitude, latitude],
            zoom: 16.4,
            pitch: 48,
            bearing: -26,
            interactive: false,
            attributionControl: false,
            canvasContextAttributes: { preserveDrawingBuffer: true },
            fadeDuration: 0,
          });
          map.on("style.load", () => {
            if (!map || disposed) return;
            // Tiny thumbnails focus on urban geometry; attribution is beside the list.
            for (const layer of map.getStyle().layers) {
              if (layer.type === "symbol")
                map.setLayoutProperty(layer.id, "visibility", "none");
            }
            if (map.getSource("openmaptiles"))
              map.addLayer({
                id: "preview-buildings",
                type: "fill-extrusion",
                source: "openmaptiles",
                "source-layer": "building",
                paint: {
                  "fill-extrusion-color": "#666a70",
                  "fill-extrusion-height": [
                    "coalesce",
                    ["get", "render_height"],
                    8,
                  ],
                  "fill-extrusion-opacity": 0.9,
                },
              });
            map.once("idle", () => {
              if (!map || disposed) return;
              try {
                const image = map.getCanvas().toDataURL("image/png");
                if (previews.size >= 64)
                  previews.delete(previews.keys().next().value!);
                previews.set(key, image);
                setPreview(image);
              } catch {
                setUnavailable(true);
              }
              release();
            });
          });
          timeout = setTimeout(() => {
            if (!disposed) setUnavailable(true);
            release();
          }, 30000);
        } catch {
          setUnavailable(true);
          release();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(host.current);
    return () => {
      disposed = true;
      observer.disconnect();
      release();
    };
  }, [longitude, latitude]);
  return (
    <span
      className={`${styles.thumbnail}${compact ? ` ${styles.compact}` : ""}`}
      aria-hidden="true"
      title={
        coordinates ? "Demo location · simulated space" : "Location unavailable"
      }
    >
      <span ref={host} className={styles.renderer} />
      {preview && <img className={styles.image} src={preview} alt="" />}
      {!preview && (
        <span className={styles.fallback}>
          <AssetIcon kind={kind} size={22} />
        </span>
      )}
      {coordinates && !unavailable && <span className={styles.pin} />}
      <span className={styles.badge}>
        <AssetIcon kind={kind} size={13} />
      </span>
    </span>
  );
}
