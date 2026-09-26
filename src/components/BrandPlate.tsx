/** Logo lab picks, rendered inline so app fonts apply. variant: "plate" (10-A1), "stack" (01-A1), "grid" (09-x3). */
export type BrandVariant = "plate" | "stack" | "grid";
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
function PinRoof({ x, y, s, color = Y }: { x: number; y: number; s: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 64})`} fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round">
      <path d="M32 6 10 24v22h13l9 12 9-12h13V24Z" />
      <g fill={color} stroke="none"><rect x="21" y="27" width="6" height="6" /><rect x="29" y="27" width="6" height="6" /><rect x="37" y="27" width="6" height="6" /><rect x="21" y="35" width="6" height="6" /><rect x="29" y="35" width="6" height="6" /><rect x="37" y="35" width="6" height="6" /></g>
    </g>
  );
}
export function BrandMark({ size = 32, className = "", variant = "stack" }: { size?: number; className?: string; variant?: BrandVariant }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ color: Y }}>
      {variant === "stack" ? <PinRoof x={0} y={0} s={64} /> : <Steps x={0} y={0} s={64} />}
    </svg>
  );
}
const upright = { fontStyle: "normal" as const };
export default function BrandPlate({ className = "", width = 190, variant = "stack" }: { className?: string; width?: number; variant?: BrandVariant }) {
  const label = "TOKENIZE TOKYO 東京トークン化計画";
  if (variant === "stack") {
    const height = Math.round((width * 64) / 190);
    return (
      <svg className={className} width={width} height={height} viewBox="0 0 190 64" role="img" aria-label={label}>
        <PinRoof x={0} y={4} s={56} />
        <text x="64" y="27" fontFamily="'Bebas Neue', 'Anton', Impact, sans-serif" fontSize="27" fill={Y} style={{ ...upright, letterSpacing: "1.4px" }}>TOKENIZE</text>
        <text x="64" y="50" fontFamily="'Bebas Neue', 'Anton', Impact, sans-serif" fontSize="27" fill={Y} style={{ ...upright, letterSpacing: "1.4px" }}>TOKYO</text>
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
        <line x1="158" y1="0" x2="158" y2="22" stroke={Y} strokeWidth="1.2" />
        <g transform="translate(158 30)"><path d="M0-8 8-3.4V5.8L0 10.4-8 5.8V-3.4Z" fill="#c9bb2f" /><path d="M0-8 8-3.4 0 1.2-8-3.4Z" fill={Y} /><path d="M0 1.2 8-3.4V5.8L0 10.4Z" fill="#9e9226" /></g>
        <text x="12" y="36" fontFamily="'Anton', 'Bebas Neue', Impact, sans-serif" fontSize="24" fill={INK} style={{ ...upright, letterSpacing: "0.6px" }}>TOKENIZE TOKYO</text>
        <text x="12.5" y="52" fontFamily="'DM Sans', 'Noto Sans JP', sans-serif" fontWeight="500" fontSize="6.4" fill={MUTED} style={{ ...upright, letterSpacing: "2.4px" }}>東京トークン化計画</text>
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
