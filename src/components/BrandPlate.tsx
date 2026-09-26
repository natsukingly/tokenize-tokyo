/** Logo lab v2 pick: data plate (10-A1) with the stepped-building mark (01-x2). Inline SVG so the app fonts apply. */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" fill="currentColor">
      <path d="M24 6h16l3 9H21Z" />
      <rect x="16" y="19" width="32" height="10" rx="1" />
      <path d="M10 33h44v11a2 2 0 0 1-2 2H42L32 61 22 46H12a2 2 0 0 1-2-2Z" />
    </svg>
  );
}
export default function BrandPlate({ className = "", width = 236 }: { className?: string; width?: number }) {
  const height = Math.round((width * 64) / 250);
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 250 64" role="img" aria-label="TOKENIZE TOKYO 東京トークン化計画">
      <rect x="0.75" y="0.75" width="248.5" height="62.5" rx="8" fill="#0b0c0e" stroke="#3a3e45" strokeWidth="1.5" />
      <rect x="10" y="12" width="4" height="40" rx="1.5" fill="#f0df37" />
      <g transform="translate(22 14) scale(0.5625)" fill="#f0df37">
        <path d="M24 6h16l3 9H21Z" />
        <rect x="16" y="19" width="32" height="10" rx="1" />
        <path d="M10 33h44v11a2 2 0 0 1-2 2H42L32 61 22 46H12a2 2 0 0 1-2-2Z" />
      </g>
      <text x="62" y="32" fontFamily="'DM Sans', 'Manrope', sans-serif" fontWeight="700" fontSize="17" fill="#f1f2f3" style={{ fontStyle: "normal", letterSpacing: "0.2px" }}>TOKENIZE TOKYO</text>
      <text x="62.5" y="47" fontFamily="'DM Sans', 'Noto Sans JP', sans-serif" fontWeight="500" fontSize="6.6" fill="#8b9098" style={{ fontStyle: "normal", letterSpacing: "0.9px" }}>東京トークン化計画 · URBAN RIGHTS PROTOCOL</text>
      <g fill="#3a3e45"><circle cx="240" cy="10" r="1.6" /><circle cx="240" cy="54" r="1.6" /></g>
      <text x="240" y="34.5" fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontSize="6" fill="#f0df37" textAnchor="middle" style={{ fontStyle: "normal", letterSpacing: "0" }}>01</text>
    </svg>
  );
}
