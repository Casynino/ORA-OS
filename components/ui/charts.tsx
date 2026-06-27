import { cn } from "@/lib/utils";

/** Responsive CSS bar chart — server-renderable, no dependencies. */
export function BarChart({
  data,
  height = 180,
  className,
  showValues = true,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  className?: string;
  showValues?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={className}>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-end gap-1.5"
          >
            {showValues && (
              <span className="text-[10px] font-medium text-muted-foreground">
                {d.value}
              </span>
            )}
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max((d.value / max) * 100, 2)}%`,
                background: d.color ?? "hsl(var(--primary))",
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 truncate text-center text-[10px] text-muted-foreground"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** SVG area/line chart for trends. */
export function AreaChart({
  data,
  height = 120,
  className,
  color = "hsl(var(--primary))",
}: {
  data: number[];
  height?: number;
  className?: string;
  color?: string;
}) {
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const n = data.length;
  const points = data.map((v, i) => {
    const x = n === 1 ? 50 : (i / (n - 1)) * 100;
    const y = 100 - ((v - min) / range) * 92 - 4;
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,100 ${line} 100,100`;
  const id = `grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SVG donut for compositions. */
export function DonutChart({
  segments,
  size = 168,
  thickness = 20,
  centerLabel,
  centervalue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centervalue?: React.ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={thickness}
          />
          {segments.map((seg, i) => {
            const len = (seg.value / total) * circ;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        {(centerLabel || centervalue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-semibold">
              {centervalue}
            </span>
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 rounded-full"
              style={{ background: seg.color }}
            />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
