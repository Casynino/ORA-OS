import type { CSSProperties } from "react";

/** Deterministic pseudo-random (same on server + client → no hydration mismatch). */
function prand(i: number, n: number) {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const STAR_COUNT = 90;

/** Theme-aware backdrop — soft aurora glow + a twinkling starfield (galaxy feel). */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* Aurora glows */}
      <div className="aurora-blob aurora-1" />
      <div className="aurora-blob aurora-2" />
      <div className="aurora-blob aurora-3" />

      {/* Starfield — dark mode only */}
      <div className="absolute inset-0 hidden dark:block">
        {Array.from({ length: STAR_COUNT }).map((_, i) => {
          const size = (1 + prand(i, 3) * 2.2).toFixed(2);
          const style: CSSProperties = {
            left: `${(prand(i, 1) * 100).toFixed(3)}%`,
            top: `${(prand(i, 2) * 100).toFixed(3)}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDelay: `${(prand(i, 4) * 6).toFixed(2)}s`,
            ["--star-o" as string]: (0.25 + prand(i, 6) * 0.6).toFixed(2),
            ["--star-d" as string]: `${(2.4 + prand(i, 5) * 4).toFixed(2)}s`,
          };
          return <span key={i} className="star" style={style} />;
        })}
        <span className="shooting-star" style={{ top: "10%", left: "6%" }} />
        <span
          className="shooting-star"
          style={{ top: "28%", left: "52%", animationDelay: "4.5s" }}
        />
      </div>

      <div className="absolute inset-0 bg-grid opacity-[0.05]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
