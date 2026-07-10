import React, { useState } from 'react';

// Brand-aligned categorical order (fixed, never cycled) + reserved status colors.
export const SERIES_COLORS = ['#fbbf24', '#2dd4bf', '#38bdf8', '#a78bfa', '#34d399', '#fb7185'];
export const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24', active: '#38bdf8', customer: '#34d399', dormant: '#94a3b8'
};
const GRID = 'rgba(255,255,255,0.07)';
const AXIS_TEXT = '#7f8ea3';

type Series = { name: string; color: string; points: number[] };

/* ---------------- Trend (line / area, 1–N series, one shared axis) --------- */
export const TrendChart: React.FC<{ series: Series[]; labels: string[]; height?: number; area?: boolean }> = ({
  series, labels, height = 170, area = true
}) => {
  const W = 640;
  const H = height;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = labels.length;
  const maxV = Math.max(1, ...series.flatMap((s) => s.points));
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxV) * plotH;
  const [hover, setHover] = useState<number | null>(null);

  const ticks = 3;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxV / ticks) * i));

  const linePath = (pts: number[]) => pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const areaPath = (pts: number[]) => `${linePath(pts)} L ${x(n - 1)} ${padT + plotH} L ${x(0)} ${padT + plotH} Z`;

  return (
    <div>
      {series.length > 1 && (
        <div className="flex items-center gap-4 mb-2">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" preserveAspectRatio="none">
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y(gv) + 3} textAnchor="end" fontSize={9} fill={AXIS_TEXT}>{gv}</text>
          </g>
        ))}
        {series.map((s, si) => (
          <g key={s.name}>
            {area && series.length === 1 && (
              <>
                <defs>
                  <linearGradient id={`grad-${si}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={areaPath(s.points)} fill={`url(#grad-${si})`} />
              </>
            )}
            <path d={linePath(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && (
              <circle cx={x(hover)} cy={y(s.points[hover])} r={3.5} fill={s.color} stroke="#0b1220" strokeWidth={1.5} />
            )}
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />}
        {/* hover hit areas */}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - plotW / (2 * Math.max(1, n - 1))} y={padT} width={plotW / Math.max(1, n - 1)} height={plotH}
            fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      <div className="flex justify-between text-[0.6rem] text-slate-500 px-1 mt-1">
        <span>{labels[0]?.slice(5)}</span>
        {hover !== null && (
          <span className="text-slate-300">
            {labels[hover]?.slice(5)} · {series.map((s) => `${s.name} ${s.points[hover]}`).join('  ·  ')}
          </span>
        )}
        <span>{labels[n - 1]?.slice(5)}</span>
      </div>
    </div>
  );
};

/* ---------------- Donut (composition, with legend + hover) ----------------- */
export const DonutChart: React.FC<{ segments: { label: string; value: number; color: string }[]; centerLabel?: string }> = ({
  segments, centerLabel = 'total'
}) => {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = 52;
  const stroke = 18;
  const C = 2 * Math.PI * R;
  const gap = 6; // 2px surface gap in circumference units
  const [hover, setHover] = useState<number | null>(null);
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" width={128} height={128} role="img">
        <g transform="translate(70,70) rotate(-90)">
          <circle r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          {segments.map((s, i) => {
            const frac = s.value / total;
            const len = Math.max(0, frac * C - gap);
            const dash = `${len} ${C - len}`;
            const el = (
              <circle key={s.label} r={R} fill="none" stroke={s.color} strokeWidth={hover === i ? stroke + 3 : stroke}
                strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="butt"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ transition: 'stroke-width .15s' }} />
            );
            offset += frac * C;
            return el;
          })}
        </g>
        <text x={70} y={66} textAnchor="middle" fontSize={22} fontWeight={700} fill="#e8eef7">
          {hover !== null ? segments[hover].value : total}
        </text>
        <text x={70} y={82} textAnchor="middle" fontSize={9} fill={AXIS_TEXT} style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {hover !== null ? segments[hover].label : centerLabel}
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={s.label} className={`flex items-center gap-2 text-sm ${hover === i ? 'text-white' : 'text-slate-300'}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="capitalize">{s.label}</span>
            <span className="text-slate-500 ml-auto tabular-nums">{s.value} · {Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------- Horizontal bars (magnitude / ranking) -------------------- */
export const BarRows: React.FC<{ items: { label: string; value: number }[]; color?: string }> = ({
  items, color = '#fbbf24'
}) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3 text-sm">
          <span className="font-mono text-xs text-slate-300 truncate w-40 shrink-0" title={it.label}>{it.label}</span>
          <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </div>
          <span className="text-slate-400 tabular-nums w-8 text-right shrink-0">{it.value}</span>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-slate-500">No data yet.</p>}
    </div>
  );
};
