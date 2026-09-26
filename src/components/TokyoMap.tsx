"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import { ASSET_KINDS, SPACE_TYPES } from "@/lib/catalog";
import AssetIcon from "./AssetIcon";
import type { Asset, Right } from "@/lib/model";
import type { VisualTheme } from "@/lib/use-theme";
import { lensMatch, type DormantSite, type LensKind } from "@/lib/dormant";
import type { FeatureCollection, Feature, Polygon, LineString } from "geojson";
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
function footprint(a: Asset, scale = 1): [number, number][] {
  const [x, y] = a.coordinates,
    w = (Math.max(14, Math.sqrt(a.area || 200)) * scale) / 91000,
    h = w * 0.8;
  return [
    [x - w, y - h],
    [x + w, y - h],
    [x + w, y + h],
    [x - w, y + h],
    [x - w, y - h],
  ];
}
export default function TokyoMap({
  assets,
  selected,
  filterActive = false,
  fundingProjects = [],
  onSelect,
  highlighted = [],
  pick,
  onPick,
  xray = false,
  activated = [],
  scopes = [],
  onScope,
  dormant = [],
  lens = false,
  lensKind = "All assets",
  onDormantSelect,
  theme = "original",
}: {
  assets: Asset[];
  selected?: string;
  filterActive?: boolean;
  fundingProjects?: { assetId: string; percent: number }[];
  onSelect: (id: string) => void;
  highlighted?: string[];
  pick?: boolean;
  onPick?: (point: [number, number]) => void;
  xray?: boolean;
  activated?: string[];
  scopes?: Right[];
  onScope?: (id: string, scope: string) => void;
  dormant?: DormantSite[];
  lens?: boolean;
  lensKind?: LensKind;
  onDormantSelect?: (site: DormantSite) => void;
  theme?: VisualTheme;
}) {
  const container = useRef<HTMLDivElement>(null),
    iconTemplates = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]),
    [ready, setReady] = useState(false),
    [basemapReady, setBasemapReady] = useState(false),
    [slow, setSlow] = useState(false),
    [mapAttempt, setMapAttempt] = useState(0),
    [error, setError] = useState(""),
    [tileRevision, setTileRevision] = useState(0);
  const actions = useRef({ pick, onPick, onSelect, onScope, onDormantSelect });
  actions.current = { pick, onPick, onSelect, onScope, onDormantSelect };
  const dormantById = useRef(new Map<string, DormantSite>());
  const focused = useRef("");
  useEffect(() => {
    if (!container.current) return;
    setReady(false);
    setBasemapReady(false);
    setSlow(false);
    setError("");
    const slowTimer = setTimeout(() => setSlow(true), 15000);
    try {
      const m = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        center: [139.775, 35.689],
        zoom: 14.2,
        pitch: 58,
        bearing: -26,
        attributionControl: { compact: true },
      });
      map.current = m;
      const cityPainted = () => {
        if (
          m.getLayer("tokyo-buildings") &&
          m.isSourceLoaded("openmaptiles") &&
          m.queryRenderedFeatures({ layers: ["tokyo-buildings"] }).length > 0
        ) {
          setBasemapReady(true);
          setError("");
          clearTimeout(slowTimer);
          m.off("render", cityPainted);
        }
      };
      // Require both loaded viewport tiles and drawn buildings: the first edge
      // tile alone can otherwise hide the loader over a mostly empty city.
      m.on("render", cityPainted);
      const updateMarkerScale = () =>
        container.current?.classList.toggle(
          "compact-markers",
          m.getZoom() < 13.5,
        );
      m.on("zoom", updateMarkerScale);
      updateMarkerScale();
      m.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "bottom-right",
      );
      m.on("style.load", () => {
        m.setPaintProperty("building", "fill-color", "#273a31");
        m.addLayer({
          id: "tokyo-buildings",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": "#43564a",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": [
              "coalesce",
              ["get", "render_min_height"],
              0,
            ],
            "fill-extrusion-opacity": 0.8,
          },
        });
        for (const id of ["urban-spaces", "basket-links", "dormant-sites"])
          m.addSource(id, { type: "geojson", data: EMPTY });
        m.addLayer({
          id: "urban-scope",
          type: "fill-extrusion",
          source: "urban-spaces",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-height": ["get", "top"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-opacity": 0.9,
            "fill-extrusion-vertical-gradient": false,
          },
        });
        m.addLayer({
          id: "basket-links-glow",
          type: "line",
          source: "basket-links",
          paint: {
            "line-color": "#d7f985",
            "line-width": 12,
            "line-opacity": 0.13,
            "line-blur": 7,
          },
        });
        m.addLayer({
          id: "basket-links-line",
          type: "line",
          source: "basket-links",
          paint: {
            "line-color": "#d7f985",
            "line-width": 2,
            "line-opacity": 0.9,
            "line-dasharray": [2, 2],
          },
        });
        // Dormant sites sit on the ground; per-feature `lit`/`lens` props drive the look.
        const lit: maplibregl.ExpressionSpecification = ["get", "lit"],
          on: maplibregl.ExpressionSpecification = ["get", "lens"];
        m.addLayer({
          id: "dormant-glow",
          type: "circle",
          source: "dormant-sites",
          paint: {
            "circle-pitch-alignment": "map",
            "circle-color": "#edff9c",
            "circle-blur": 1,
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              ["case", lit, 16, 0],
              16,
              ["case", lit, 44, 0],
            ],
            "circle-opacity": ["case", lit, 0.75, 0],
          },
        });
        m.addLayer({
          id: "dormant-dots",
          type: "circle",
          source: "dormant-sites",
          paint: {
            "circle-pitch-alignment": "map",
            "circle-color": ["case", lit, "#d7f985", "#8fae96"],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              ["case", lit, 3.5, 2],
              16,
              ["case", lit, 9, 5],
            ],
            "circle-opacity": ["case", lit, 1, on, 0.05, 0.5],
            "circle-stroke-color": "#f5ffd6",
            "circle-stroke-width": ["case", lit, 1, 0],
          },
        });
        m.on("mouseenter", "dormant-dots", (e) => {
          if (e.features?.some((f) => f.properties.lit))
            m.getCanvas().style.cursor = "pointer";
        });
        m.on(
          "mouseleave",
          "dormant-dots",
          () => (m.getCanvas().style.cursor = ""),
        );
        setReady(true);
        setError("");
        m.once("idle", () => setTileRevision((n) => n + 1));
      });
      m.on("error", (e) => {
        if (
          String(e.error?.message).includes("style") ||
          ("sourceId" in e && e.sourceId === "openmaptiles") ||
          !m.isStyleLoaded()
        )
          setError("Map tiles are unavailable. Asset cards remain usable.");
      });
      m.on("click", (e) => {
        const features = m.getLayer("urban-scope")
          ? m.queryRenderedFeatures(e.point, { layers: ["urban-scope"] })
          : [];
        const lit = m.getLayer("dormant-dots")
          ? m
              .queryRenderedFeatures(e.point, { layers: ["dormant-dots"] })
              .find((f) => f.properties.lit)
          : undefined;
        const site = lit && dormantById.current.get(String(lit.properties.id));
        if (site && actions.current.onDormantSelect)
          return actions.current.onDormantSelect(site);
        const f = features[0];
        if (f) {
          actions.current.onSelect(String(f.properties.assetId));
          actions.current.onScope?.(
            String(f.properties.assetId),
            String(f.properties.scope),
          );
        }
        if (actions.current.pick)
          actions.current.onPick?.([
            Number(e.lngLat.lng.toFixed(6)),
            Number(e.lngLat.lat.toFixed(6)),
          ]);
      });
      const resizeObserver = new ResizeObserver(() => m.resize());
      resizeObserver.observe(container.current);
      return () => {
        clearTimeout(slowTimer);
        resizeObserver.disconnect();
        markers.current.forEach((x) => x.remove());
        markers.current = [];
        m.remove();
        if (map.current === m) map.current = null;
      };
    } catch {
      clearTimeout(slowTimer);
      setError("WebGL is unavailable. Use the asset list to explore Tokyo.");
    }
  }, [mapAttempt]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    // Fast Refresh can recreate the map before React's ready flag resets.
    if (!m.getSource("urban-spaces") || !m.getSource("basket-links")) return;
    const cyber = theme === "cyberpunk";
    container.current?.classList.toggle("dense-markers", assets.length > 80);
    const spaceColor = (a: Asset) =>
      cyber
        ? a.id === selected || highlighted.includes(a.id) || filterActive
          ? "#f0df37"
          : "#8c9098"
        : filterActive
          ? "#d7f985"
          : SPACE_TYPES[a.kind].color;
    markers.current.forEach((x) => x.remove());
    markers.current = assets.map((a) => {
      const funding = fundingProjects.find((c) => c.assetId === a.id);
      const el = document.createElement("button");
      el.className =
        "map-pin " +
        (a.kind === "Rooftop" ? "solar" : "home") +
        (a.id === selected ? " selected" : "") +
        (highlighted.includes(a.id) ? " highlighted" : "") +
        (filterActive ? " matched" : "") +
        (funding ? " funding" : "");
      el.setAttribute("aria-label", "Explore " + a.name);
      el.dataset.assetId = a.id;
      if (funding)
        el.title = `Funding open · ${Math.round(funding.percent)}% subscribed`;
      const icon = document.createElement("span");
      icon.className = "map-pin-icon";
      icon.setAttribute("aria-hidden", "true");
      // Reuse the same SVG icons as the filters without creating a React root per marker.
      const graphic = iconTemplates.current?.querySelector(
        `[data-asset-kind="${a.kind}"] svg`,
      );
      if (graphic) icon.append(graphic.cloneNode(true));
      el.style.borderColor = spaceColor(a);
      const label = document.createElement("b");
      label.textContent = a.name;
      if (funding) {
        const status = document.createElement("small");
        status.className = "map-pin-funding";
        status.textContent = `Funding · ${Math.round(funding.percent)}%`;
        label.append(status);
        const track = document.createElement("span");
        track.className = "map-funding-track";
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", "Offer subscribed");
        track.setAttribute(
          "aria-valuenow",
          String(Math.min(100, funding.percent)),
        );
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        const fill = document.createElement("span");
        fill.style.width = `${Math.min(100, funding.percent)}%`;
        track.append(fill);
        label.append(track);
      }
      el.append(icon, label);
      el.onclick = (e) => {
        e.stopPropagation();
        actions.current.onSelect(a.id);
      };
      return new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(a.coordinates)
        .addTo(m);
    });
    const features: Feature<Polygon>[] = [];
    const buildings = m.querySourceFeatures("openmaptiles", {
      sourceLayer: "building",
    });
    const surface = (asset: Asset) => {
      let nearest: (typeof buildings)[number] | undefined,
        distance = Infinity;
      for (const b of buildings) {
        if (b.geometry.type !== "Polygon") continue;
        const ring = b.geometry.coordinates[0];
        const center = ring.reduce(
          (p, c) => [p[0] + c[0] / ring.length, p[1] + c[1] / ring.length],
          [0, 0],
        );
        const d =
          (center[0] - asset.coordinates[0]) ** 2 +
          (center[1] - asset.coordinates[1]) ** 2;
        if (d < distance) {
          distance = d;
          nearest = b;
        }
      }
      if (
        nearest &&
        distance < 0.0007 ** 2 &&
        nearest.geometry.type === "Polygon"
      )
        return {
          polygon: nearest.geometry.coordinates[0] as [number, number][],
          height: Math.max(Number(nearest.properties.render_height) || 12, 12),
        };
      return {
        polygon: footprint(asset),
        height: asset.kind === "Rooftop" ? 55 : 16,
      };
    };
    for (const a of assets) {
      const defaultScope = [
        "Rooftop",
        "Interior",
        "Wall",
        "Land",
        "Whole asset",
      ].indexOf(SPACE_TYPES[a.kind].scope);
      const roof = a.kind === "Rooftop",
        active = activated.includes(a.id),
        building = surface(a),
        top = building.height;
      const own = scopes.filter((r) => r.assetId === a.id);
      const layers = xray
        ? Array.from(
            new Set(own.length ? own.map((r) => r.scope) : [defaultScope]),
          )
        : [defaultScope];
      layers.forEach((scope) => {
        const names = ["Rooftop", "Interior", "Wall", "Land", "Whole asset"];
        let polygon = building.polygon,
          base = scope === 0 ? top : scope === 1 ? 6 : scope === 2 ? 0 : 0,
          high =
            scope === 0
              ? top + 3
              : scope === 1
                ? 10
                : scope === 2
                  ? top
                  : scope === 3
                    ? 2
                    : top + 3;
        if (scope === 2) {
          const [x, y] = a.coordinates;
          const w = 0.00015;
          polygon = [
            [x - w, y - w],
            [x + w, y - w],
            [x + w, y - w + 0.000025],
            [x - w, y - w + 0.000025],
            [x - w, y - w],
          ];
        }
        features.push({
          type: "Feature",
          properties: {
            assetId: a.id,
            scope: names[scope],
            color:
              highlighted.includes(a.id) || filterActive || a.id === selected
                ? cyber
                  ? "#f0df37"
                  : "#edff9c"
                : scope === 1
                  ? cyber
                    ? "#b8bbc1"
                    : "#e3b76d"
                  : active
                    ? cyber
                      ? "#cdd0d5"
                      : "#7ce6b6"
                    : spaceColor(a),
            base,
            top: high,
          },
          geometry: { type: "Polygon", coordinates: [polygon] },
        });
      });
      if (active && roof) {
        const [x, y] = a.coordinates;
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            const panel = {
              ...a,
              coordinates: [x + (i - 1) * 0.0001, y + (j - 1) * 0.00008] as [
                number,
                number,
              ],
              area: 4,
            };
            features.push({
              type: "Feature",
              properties: {
                assetId: a.id,
                scope: "Rooftop",
                color: cyber ? "#f0df37" : "#248cb5",
                base: top + 3,
                top: top + 4,
              },
              geometry: {
                type: "Polygon",
                coordinates: [footprint(panel, 0.22)],
              },
            });
          }
      }
    }
    (m.getSource("urban-spaces") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    m.setPaintProperty(
      "tokyo-buildings",
      "fill-extrusion-opacity",
      xray || lens ? 0.13 : filterActive ? 0.28 : 0.8,
    );
    m.setPaintProperty("building", "fill-color", cyber ? "#292c31" : "#273a31");
    m.setPaintProperty(
      "tokyo-buildings",
      "fill-extrusion-color",
      cyber ? "#454a52" : "#43564a",
    );
    for (const id of ["basket-links-glow", "basket-links-line"])
      m.setPaintProperty(id, "line-color", cyber ? "#f0df37" : "#d7f985");
    m.setPaintProperty(
      "dormant-glow",
      "circle-color",
      cyber ? "#f0df37" : "#edff9c",
    );
    m.setPaintProperty("dormant-dots", "circle-color", [
      "case",
      ["get", "lit"],
      cyber ? "#f0df37" : "#d7f985",
      cyber ? "#858992" : "#8fae96",
    ]);
    const points = assets.filter((a) => highlighted.includes(a.id));
    const links: Feature<LineString>[] = [];
    if (points.length > 1) {
      const center: [number, number] = [
        points.reduce((n, a) => n + a.coordinates[0], 0) / points.length,
        points.reduce((n, a) => n + a.coordinates[1], 0) / points.length,
      ];
      for (const a of points) {
        const coords: [number, number][] = [];
        for (let i = 0; i <= 30; i++) {
          const t = i / 30;
          coords.push([
            a.coordinates[0] * (1 - t) + center[0] * t,
            a.coordinates[1] * (1 - t) +
              center[1] * t +
              Math.sin(t * Math.PI) * 0.001,
          ]);
        }
        links.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        });
      }
    }
    (m.getSource("basket-links") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: links,
    });
    const focus = selected + "|" + highlighted.join(",");
    if (focused.current !== focus) {
      m.stop();
      focused.current = focus;
      if (points.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((a) => bounds.extend(a.coordinates));
        m.fitBounds(bounds, {
          padding: 100,
          pitch: 50,
          duration: 1400,
          maxZoom: 15,
        });
      } else {
        const a = assets.find((a) => a.id === selected);
        if (a)
          m.flyTo({
            center: a.coordinates,
            zoom: 15.2,
            pitch: 60,
            duration: 1300,
          });
      }
    }
  }, [
    assets,
    selected,
    filterActive,
    fundingProjects,
    highlighted,
    ready,
    xray,
    lens,
    activated,
    scopes,
    tileRevision,
    theme,
  ]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const source = map.current.getSource("dormant-sites") as
      maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    dormantById.current = new Map(dormant.map((s) => [s.id, s]));
    source.setData({
      type: "FeatureCollection",
      features: dormant.map((s) => ({
        type: "Feature",
        properties: {
          id: s.id,
          kind: s.kind,
          lens,
          lit: lens && lensMatch(s, lensKind),
        },
        geometry: { type: "Point", coordinates: s.coordinates },
      })),
    });
  }, [dormant, lens, lensKind, ready]);
  return (
    <div
      className={"map-stage" + (pick ? " picking" : "")}
      data-basemap-state={basemapReady ? "ready" : error ? "error" : "loading"}
    >
      <div hidden ref={iconTemplates} aria-hidden="true">
        {ASSET_KINDS.map((kind) => (
          <span key={kind} data-asset-kind={kind}>
            <AssetIcon kind={kind} size={18} />
          </span>
        ))}
      </div>
      <div className="map-canvas" ref={container} />
      {!ready && !error && (
        <div className="map-loading" role="status">
          <LoaderCircle size={24} className="spin" aria-hidden="true" />
          {slow
            ? "The city map is taking longer to load."
            : "Loading Tokyo in three dimensions…"}
          {slow && (
            <button
              className="secondary"
              onClick={() => setMapAttempt((n) => n + 1)}
            >
              Retry map
            </button>
          )}
        </div>
      )}
      {(error || (ready && !basemapReady)) && (
        <div className="map-connection-status" role="status">
          {!error && (
            <LoaderCircle size={16} className="spin" aria-hidden="true" />
          )}
          <span>
            {error ||
              (slow
                ? "The city map is taking longer to load."
                : "Loading city buildings…")}
          </span>
          {(error || slow) && (
            <button onClick={() => setMapAttempt((n) => n + 1)}>
              Retry map
            </button>
          )}
        </div>
      )}
      <div className="map-label">
        <span>35°41′ N · 139°46′ E</span>
        <strong>
          {xray
            ? "URBAN RIGHTS / X-RAY"
            : lens
              ? "DORMANT CITY / LENS"
              : "TOKYO / 東京"}
        </strong>
      </div>
      <div className="map-disclaimer">
        {pick
          ? "Click the map to choose a demo location"
          : "3D basemap · OpenStreetMap / OpenFreeMap"}
        <br />
        Highlighted spaces and dimensions are simulated.
      </div>
    </div>
  );
}
