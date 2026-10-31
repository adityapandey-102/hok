"use client";

import { useId, useRef, useState } from "react";
import type { WeekPoint } from "../api/reportsApi";
import { weekLabel } from "../lib/reportFormat";

const ASSIGNED = "var(--color-info)";
const COMPLETED = "var(--color-success)";

/**
 * Dependency-free SVG chart for the staff report: assigned vs completed per
 * week of the month, two area+line series with a hover guide and tooltip.
 * Responsive through its viewBox; colours come from the theme's CSS variables
 * so it follows light and dark. Hand-rolled (needleye's approach): a couple of
 * series over a handful of weeks doesn't warrant a chart library.
 */
export function WeeklyChart({ weeks }: { weeks: WeekPoint[] }) {
  const gid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 240;
  const pad = { top: 18, right: 28, bottom: 34, left: 30 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const n = weeks.length;
  const maxY = Math.max(1, ...weeks.map((w) => Math.max(w.assigned, w.completed)));
  const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  const line = (key: "assigned" | "completed") => weeks.map((w, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(w[key]).toFixed(1)}`).join(" ");
  const area = (key: "assigned" | "completed") => {
    const base = pad.top + innerH;
    return `${line(key)} L ${x(n - 1).toFixed(1)} ${base} L ${x(0).toFixed(1)} ${base} Z`;
  };

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const vbx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - vbx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  }

  if (n === 0) return <p className="text-sm text-text-muted">No weeks in this month.</p>;
  const hx = hover != null ? x(hover) : 0;
  const active = hover != null ? weeks[hover]! : null;

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y select-none"
        role="img"
        aria-label={`Tasks assigned vs completed per week: ${weeks.map((w) => `${weekLabel(w.startDay, w.endDay)}, ${w.assigned} assigned, ${w.completed} completed`).join("; ")}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`a${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ASSIGNED} stopOpacity="0.26" />
            <stop offset="100%" stopColor={ASSIGNED} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`c${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COMPLETED} stopOpacity="0.24" />
            <stop offset="100%" stopColor={COMPLETED} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines at 0 / mid / max (no middle line when the top is 1: it would read "1" twice) */}
        {[0, 0.5, 1]
          .filter((f) => f !== 0.5 || maxY >= 2)
          .map((f) => {
            const gy = pad.top + innerH - f * innerH;
            return (
              <g key={f}>
                <line x1={pad.left} y1={gy} x2={W - pad.right} y2={gy} className="stroke-border-light" strokeWidth={1} />
                <text x={pad.left - 8} y={gy + 3} textAnchor="end" className="fill-text-muted text-[10px]">
                  {Math.round(f * maxY)}
                </text>
              </g>
            );
          })}

        {weeks.map((w, i) => (
          <text key={w.startDay} x={x(i)} y={H - 10} textAnchor="middle" className="fill-text-muted text-[10px]">
            {weekLabel(w.startDay, w.endDay)}
          </text>
        ))}

        {hover != null && <line x1={hx} y1={pad.top} x2={hx} y2={pad.top + innerH} className="stroke-border" strokeWidth={1} strokeDasharray="3 3" />}

        <path d={area("assigned")} fill={`url(#a${gid})`} />
        <path d={area("completed")} fill={`url(#c${gid})`} />
        <path d={line("assigned")} fill="none" strokeWidth={2.5} strokeLinejoin="round" style={{ stroke: ASSIGNED }} />
        <path d={line("completed")} fill="none" strokeWidth={2.5} strokeLinejoin="round" style={{ stroke: COMPLETED }} />

        {weeks.map((w, i) => (
          <g key={w.startDay}>
            <circle cx={x(i)} cy={y(w.assigned)} r={hover === i ? 5 : 3} style={{ fill: ASSIGNED }} className="transition-all" />
            <circle cx={x(i)} cy={y(w.completed)} r={hover === i ? 5 : 3} style={{ fill: COMPLETED }} className="transition-all" />
          </g>
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-app-sm border border-border bg-card px-2.5 py-1.5 text-xs shadow-app-md"
          style={{ left: `${Math.min(88, Math.max(12, (hx / W) * 100))}%` }}
        >
          <div className="mb-1 font-semibold whitespace-nowrap text-text-primary">{weekLabel(active.startDay, active.endDay)}</div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: ASSIGNED }} /> Assigned
            <span className="ml-auto pl-3 font-semibold text-text-primary">{active.assigned}</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COMPLETED }} /> Completed
            <span className="ml-auto pl-3 font-semibold text-text-primary">{active.completed}</span>
          </div>
        </div>
      )}

      <div className="mt-1 flex gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-full" style={{ background: ASSIGNED }} /> Assigned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-full" style={{ background: COMPLETED }} /> Completed
        </span>
      </div>
    </div>
  );
}
