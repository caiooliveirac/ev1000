/**
 * Legend — bottom bar showing severity scale and blood type colors.
 */

import { severityColor } from './colors';

interface Props { arteryColor: string; veinColor: string }

export function Legend({ arteryColor, veinColor }: Props) {
  const fs: React.CSSProperties = { fontSize: 7, fill: '#4a6d96', fontFamily: '"IBM Plex Sans", sans-serif' };
  return (
    <g transform="translate(15, 462)">
      <circle cx={5} cy={0} r={3} fill={severityColor(0)} opacity={0.7} />
      <text x={12} y={3.5} style={fs}>Normal</text>
      <circle cx={58} cy={0} r={3} fill={severityColor(0.5)} opacity={0.7} />
      <text x={65} y={3.5} style={fs}>Alerta</text>
      <circle cx={108} cy={0} r={3} fill={severityColor(1)} opacity={0.7} />
      <text x={115} y={3.5} style={fs}>Crítico</text>
      <line x1={155} y1={-3} x2={155} y2={3} stroke="#1e3352" strokeWidth={0.5} />
      <circle cx={165} cy={0} r={2} fill={arteryColor} opacity={0.7} />
      <text x={172} y={3.5} style={fs}>Arterial</text>
      <circle cx={210} cy={0} r={2} fill={veinColor} opacity={0.7} />
      <text x={217} y={3.5} style={fs}>Venoso</text>
    </g>
  );
}
