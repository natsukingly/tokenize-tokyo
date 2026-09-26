"use client";
import { useLayoutEffect, useRef, useState } from "react";
/** Logo lab picks, rendered inline so app fonts apply. variant: "plate" (10-A1), "stack" (01-A1), "grid" (09-x3). */
export type BrandVariant = "plate" | "stack" | "stackw" | "grid" | "jp" | "bar" | "mono" | "monow" | "terminal";
export const BRAND_VARIANTS: BrandVariant[] = ["stack", "stackw", "plate", "grid", "jp", "bar", "mono", "monow", "terminal"];
const Y = "#f0df37", MUTED = "#8b9098", INK = "#f1f2f3";
function Steps({ x, y, s, color = Y }: { x: number; y: number; s: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 64})`} fill={color}>
      <path d="M24 6h16l3 9H21Z" />
      <rect x="16" y="19" width="32" height="10" rx="1" />
      <path d="M10 33h44v11a2 2 0 0 1-2 2H42L32 61 22 46H12a2 2 0 0 1-2-2Z" />
    </g>
  );
}
function Ring({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={r * 0.42} />
      <circle cx={cx} cy={cy} r={r * 0.29} fill={color} />
    </g>
  );
}
function PinRoof({ x, y, s, color = Y, grid = color }: { x: number; y: number; s: number; color?: string; grid?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 64})`} fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round">
      <path d="M32 6 10 24v22h13l9 12 9-12h13V24Z" />
      <g fill={grid} stroke="none"><rect x="21" y="27" width="6" height="6" /><rect x="29" y="27" width="6" height="6" /><rect x="37" y="27" width="6" height="6" /><rect x="21" y="35" width="6" height="6" /><rect x="29" y="35" width="6" height="6" /><rect x="37" y="35" width="6" height="6" /></g>
    </g>
  );
}
export function BrandMark({ size = 32, className = "", variant = "monow" }: { size?: number; className?: string; variant?: BrandVariant }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ color: Y }}>
      {variant === "mono" || variant === "monow" ? <Ring cx={32} cy={32} r={22} color={variant === "monow" ? INK : Y} /> : variant === "stack" ? <PinRoof x={0} y={0} s={64} /> : variant === "stackw" ? <PinRoof x={0} y={0} s={64} color={INK} grid={Y} /> : <Steps x={0} y={0} s={64} />}
    </svg>
  );
}
const upright = { fontStyle: "normal" as const };
export default function BrandPlate({ className = "", width = 190, variant = "monow" }: { className?: string; width?: number; variant?: BrandVariant }) {
  const label = "TOKENIZE TOKYO 東京トークン化計画";
  if (variant === "stack" || variant === "stackw") {
    const height = Math.round((width * 64) / 190);
    const ink = variant === "stackw" ? INK : Y;
    return (
      <svg className={className} width={width} height={height} viewBox="0 0 190 64" role="img" aria-label={label}>
        <PinRoof x={0} y={4} s={56} color={ink} grid={Y} />
        <text x="64" y="27" fontFamily="'Bebas Neue', 'Anton', Impact, sans-serif" fontSize="27" fill={ink} style={{ ...upright, letterSpacing: "1.4px" }}>TOKENIZE</text>
        <text x="64" y="50" fontFamily="'Bebas Neue', 'Anton', Impact, sans-serif" fontSize="27" fill={ink} style={{ ...upright, letterSpacing: "1.4px" }}>TOKYO</text>
        <text x="64.5" y="61" fontFamily="'DM Sans', 'Noto Sans JP', sans-serif" fontWeight="500" fontSize="6.4" fill={MUTED} style={{ ...upright, letterSpacing: "2.2px" }}>東京トークン化計画</text>
      </svg>
    );
  }
  if (variant === "grid") {
    const height = Math.round((width * 64) / 190);
    return (
      <svg className={className} width={width} height={height} viewBox="0 0 190 64" role="img" aria-label={label}>
        <defs>
          <pattern id="tt-iso" width="16" height="9.238" patternUnits="userSpaceOnUse"><path d="M0 4.619 8 0l8 4.619L8 9.238Z" fill="none" stroke="#2c3036" strokeWidth="0.8" /></pattern>
        </defs>
        <rect width="190" height="64" rx="6" fill="#0b0c0e" />
        <rect width="190" height="64" rx="6" fill="url(#tt-iso)" />
        <line x1="170" y1="0" x2="170" y2="20" stroke={Y} strokeWidth="1.2" />
        <g transform="translate(170 28)"><path d="M0-8 8-3.4V5.8L0 10.4-8 5.8V-3.4Z" fill="#c9bb2f" /><path d="M0-8 8-3.4 0 1.2-8-3.4Z" fill={Y} /><path d="M0 1.2 8-3.4V5.8L0 10.4Z" fill="#9e9226" /></g>
        <text x="12" y="35" fontFamily="'Anton', 'Bebas Neue', Impact, sans-serif" fontSize="20.5" fill={INK} style={{ ...upright, letterSpacing: "0.5px" }}>TOKENIZE TOKYO</text>
        <text x="12.5" y="52" fontFamily="'DM Sans', 'Noto Sans JP', sans-serif" fontWeight="500" fontSize="6.4" fill={MUTED} style={{ ...upright, letterSpacing: "2.4px" }}>東京トークン化計画</text>
      </svg>
    );
  }
  if (variant === "jp") {
    const height = Math.round((width * 64) / 190);
    return (
      <svg className={className} width={width} height={height} viewBox="0 0 190 64" role="img" aria-label={label}>
        <rect width="190" height="64" rx="6" fill={Y} />
        <text x="95" y="36" textAnchor="middle" fontFamily="'Noto Sans JP', 'Hiragino Sans', 'Zen Kaku Gothic New', sans-serif" fontWeight="900" fontSize="20" fill="#0b0c0e" style={{ ...upright, letterSpacing: "0.5px" }}>東京トークン化計画</text>
        <text x="95" y="52" textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="700" fontSize="7" fill="#0b0c0e" style={{ ...upright, letterSpacing: "3.2px" }}>TOKENIZE TOKYO</text>
      </svg>
    );
  }
  if (variant === "bar") {
    const height = Math.round((width * 64) / 190);
    return (
      <svg className={className} width={width} height={height} viewBox="0 0 190 64" role="img" aria-label={label}>
        <text x="0" y="28" fontFamily="'Noto Sans JP', 'Hiragino Sans', sans-serif" fontWeight="700" fontSize="12.5" fill={INK} style={{ ...upright, letterSpacing: "0.3px" }}>東京トークン化計画</text>
        <rect x="0" y="35" width="190" height="2" fill={Y} />
        <text x="0" y="57" fontFamily="'Bebas Neue', 'Anton', Impact, sans-serif" fontSize="22" fill={Y} style={{ ...upright, letterSpacing: "2.6px" }}>TOKENIZE TOKYO</text>
      </svg>
    );
  }
  if (variant === "mono" || variant === "monow") return <MonoWordmark className={className} width={width} label={label} ring={variant === "monow" ? INK : Y} />;
  if (variant === "terminal") {
    const height = Math.round((width * 64) / 190);
    return (
      <svg className={className} width={width} height={height} viewBox="0 0 190 64" role="img" aria-label={label}>
        <rect width="190" height="64" rx="4" fill="#040705" stroke="#1f3a26" />
        <text x="10" y="18" fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontSize="6.5" fill="#5f7f66" style={upright}>&gt; resolve tokenizetokyo.eth</text>
        <text x="10" y="38" fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontWeight="700" fontSize="14.5" fill="#39ff14" style={{ ...upright, letterSpacing: "0.2px" }}>[ TOKENIZE_TOKYO ]</text>
        <rect x="163" y="27" width="7" height="13" fill="#39ff14" />
        <text x="10" y="54" fontFamily="'DotGothic16', 'IBM Plex Mono', monospace" fontSize="8.5" fill="#8bff9a" style={{ ...upright, letterSpacing: "1.5px" }}>東京トークン化計画</text>
      </svg>
    );
  }
  const height = Math.round((width * 64) / 250);
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 250 64" role="img" aria-label={label}>
      <rect x="0.75" y="0.75" width="248.5" height="62.5" rx="8" fill="#0b0c0e" stroke="#3a3e45" strokeWidth="1.5" />
      <rect x="10" y="12" width="4" height="40" rx="1.5" fill={Y} />
      <Steps x={22} y={14} s={36} />
      <text x="62" y="32" fontFamily="'DM Sans', 'Manrope', sans-serif" fontWeight="700" fontSize="17" fill={INK} style={{ ...upright, letterSpacing: "0.2px" }}>TOKENIZE TOKYO</text>
      <text x="62.5" y="47" fontFamily="'DM Sans', 'Noto Sans JP', sans-serif" fontWeight="500" fontSize="6.6" fill={MUTED} style={{ ...upright, letterSpacing: "0.9px" }}>東京トークン化計画 · URBAN RIGHTS PROTOCOL</text>
      <g fill="#3a3e45"><circle cx="240" cy="10" r="1.6" /><circle cx="240" cy="54" r="1.6" /></g>
      <text x="240" y="34.5" fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontSize="6" fill={Y} textAnchor="middle" style={{ ...upright, letterSpacing: "0" }}>01</text>
    </svg>
  );
}

/** "TOKENIZE TOKY" + a target ring standing in for the last O; the ring is placed from the measured text width. */
function MonoWordmark({ className, width, label, ring }: { className: string; width: number; label: string; ring: string }) {
  const textRef = useRef<SVGTextElement>(null);
  const [end, setEnd] = useState(150);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setEnd(el.getComputedTextLength());
    measure();
    if (typeof document !== "undefined" && "fonts" in document) document.fonts.ready.then(measure);
  }, []);
  const r = 7.2, cx = end + 3 + r;
  const height = Math.round((width * 64) / 190);
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 190 64" role="img" aria-label={label}>
      <text ref={textRef} x="0" y="30" fontFamily="'Manrope', 'DM Sans', sans-serif" fontWeight="800" fontSize="21" fill={INK} style={{ ...upright, letterSpacing: "-0.4px" }}>TOKENIZE TOKY</text>
      <Ring cx={cx} cy={22.6} r={r} color={ring} />
      <text x="0.5" y="50" fontFamily="'DM Sans', 'Noto Sans JP', sans-serif" fontWeight="500" fontSize="7" fill={MUTED} style={{ ...upright, letterSpacing: "2.4px" }}>東京トークン化計画 · URBAN RIGHTS</text>
    </svg>
  );
}
