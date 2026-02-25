/**
 * MetricBadge — transparent, color-coded label for hemodynamic values.
 * Used inside the SVG diagram to show metrics at anatomical locations.
 */

import { severityColor, severityAlpha } from './colors';

interface Props {
  x: number;
  y: number;
  label: string;
  value: string;
  unit?: string;
  severity: number;
  anchor?: 'start' | 'middle' | 'end';
  size?: 'sm' | 'md';
}

export function MetricBadge({
  x, y, label, value, unit, severity, anchor = 'middle', size = 'md',
}: Props) {
  const fs = size === 'sm' ? 7.5 : 9;
  const vfs = size === 'sm' ? 9 : 11.5;
  const color = severityColor(severity);
  const bg = severityAlpha(severity, 0.08);
  const border = severityAlpha(severity, 0.25);

  const textLen = `${label} ${value}${unit ? ' ' + unit : ''}`.length;
  const w = Math.max(textLen * 5.2 + 12, 42);
  const h = size === 'sm' ? 22 : 28;
  const rx = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const tx = anchor === 'start' ? rx + 5 : anchor === 'end' ? x - 5 : x;
  const ta = anchor === 'start' ? 'start' : anchor === 'end' ? 'end' : 'middle';
  const ff = '"IBM Plex Mono", monospace';

  return (
    <g>
      <rect x={rx} y={y - h / 2 - 1} width={w} height={h} rx={4} ry={4}
        fill={bg} stroke={border} strokeWidth={0.6} />
      <text x={tx} y={y - 3} textAnchor={ta}
        style={{ fontSize: fs, fontFamily: ff, fontWeight: 500, letterSpacing: 0.3, fill: 'rgba(157,176,204,0.8)' }}>
        {label}
      </text>
      <text x={tx} y={y + vfs - 2} textAnchor={ta}
        style={{ fontSize: vfs, fontFamily: ff, fontWeight: 700, letterSpacing: 0.4, fill: color }}>
        {value}
        {unit ? <tspan style={{ fontSize: fs, fontWeight: 400 }}> {unit}</tspan> : null}
      </text>
    </g>
  );
}
