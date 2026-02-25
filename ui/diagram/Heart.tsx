/**
 * Heart — EV1000-inspired red 4-chamber heart with radial gradient,
 * visible myocardial wall, RV dilation under pulmonary strain,
 * and LV ejection reflecting contractility.
 *
 * Designed to look close to the Edwards EV1000/PulsioFlex style:
 * rich crimson with 3D depth, glow, and chamber detail.
 */

import { lerp, severityAlpha } from './colors';
import type { BodyVisuals } from './visuals';

interface Props { vis: BodyVisuals }

export function Heart({ vis }: Props) {
  const rvCx = 180 + vis.rvDilation * 4;
  const raCx = 178 + vis.rvDilation * 3;

  return (
    <g style={{
      transformOrigin: '170px 172px',
      animation: `heartbeat ${vis.heartPulseRate}s ease-in-out infinite`,
    }}>
      {/* Outer glow — pulsing warm halo */}
      <ellipse cx={170} cy={172} rx={28} ry={26}
        fill="url(#heartGlow)" opacity={0.35} filter="url(#glow)" />

      {/* Myocardial wall — realistic heart shape, crimson with radial gradient */}
      <path
        d="M170 196
           Q149 191 143 175 Q138 160 144 152 Q151 144 162 148
           L170 154
           L178 148
           Q189 144 196 152 Q202 160 197 175 Q191 191 170 196Z"
        fill="url(#heartGrad)" stroke="url(#heartWall)" strokeWidth={1.2}
      />

      {/* ── Left side (viewer's left = anatomical left) ── */}
      {/* LA */}
      <ellipse cx={162} cy={158} rx={7} ry={6.5}
        fill="url(#chamberLV)" opacity={0.55}
        stroke="rgba(255,200,200,0.2)" strokeWidth={0.4} />
      {/* LV — main pump */}
      <ellipse cx={160} cy={174}
        rx={lerp(7, 10, vis.lvEjection)}
        ry={lerp(9, 13, vis.lvEjection)}
        fill="url(#chamberLV)" opacity={0.65}
        stroke="rgba(255,200,200,0.25)" strokeWidth={0.5} />

      {/* ── Right side ── */}
      {/* RA */}
      <ellipse cx={raCx} cy={158}
        rx={lerp(7, 10, vis.rvDilation)}
        ry={lerp(6.5, 9, vis.rvDilation)}
        fill="url(#chamberRV)" opacity={0.5}
        stroke="rgba(200,200,255,0.15)" strokeWidth={0.4} />
      {/* RV — dilates under strain */}
      <ellipse cx={rvCx} cy={174}
        rx={lerp(8, 14, vis.rvDilation)}
        ry={lerp(9, 14, vis.rvDilation)}
        fill="url(#chamberRV)" opacity={0.55}
        stroke={vis.rvStrain > 0.4 ? severityAlpha(vis.rvStrain, 0.6) : 'rgba(200,200,255,0.15)'}
        strokeWidth={vis.rvStrain > 0.4 ? 1.3 : 0.5}
        strokeDasharray={vis.rvStrain > 0.5 ? '3 2' : 'none'}
      />

      {/* Septum */}
      <line x1={170} y1={150} x2={170} y2={194}
        stroke="rgba(255,180,180,0.18)" strokeWidth={0.9} />
      {/* AV plane (valve level) */}
      <line x1={146} y1={165} x2={196} y2={165}
        stroke="rgba(255,180,180,0.12)" strokeWidth={0.5} />

      {/* Chamber labels */}
      <text x={162} y={161} textAnchor="middle" style={labelStyle}>AE</text>
      <text x={raCx} y={161} textAnchor="middle" style={labelStyle}>AD</text>
      <text x={160} y={178} textAnchor="middle" style={{ ...labelStyle, opacity: 0.6 }}>VE</text>
      <text x={rvCx} y={177} textAnchor="middle" style={labelStyle}>VD</text>
    </g>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 5.5,
  fill: 'rgba(255,230,230,0.5)',
  fontFamily: '"IBM Plex Mono", monospace',
  fontWeight: 600,
  letterSpacing: 0.4,
};

/**
 * SVG <defs> for the Heart component — must be rendered inside the parent <svg>.
 * Separated so the orchestrator can batch all defs together.
 */
export function HeartDefs() {
  return (
    <>
      {/* Main heart body — deep crimson radial gradient */}
      <radialGradient id="heartGrad" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="#d42a2a" stopOpacity={0.95} />
        <stop offset="55%" stopColor="#a31e1e" stopOpacity={0.88} />
        <stop offset="100%" stopColor="#6b1111" stopOpacity={0.78} />
      </radialGradient>
      {/* Myocardial wall stroke gradient */}
      <linearGradient id="heartWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e05555" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#751515" stopOpacity={0.7} />
      </linearGradient>
      {/* LV chamber — brighter red interior */}
      <radialGradient id="chamberLV" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#ef5555" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#8b1a1a" stopOpacity={0.35} />
      </radialGradient>
      {/* RV chamber — slightly bluer, venous tint */}
      <radialGradient id="chamberRV" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#c04a6a" stopOpacity={0.55} />
        <stop offset="100%" stopColor="#6b1535" stopOpacity={0.3} />
      </radialGradient>
      {/* Heart glow */}
      <radialGradient id="heartGlow" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="#e03030" stopOpacity={0.25} />
        <stop offset="100%" stopColor="#e03030" stopOpacity={0} />
      </radialGradient>
    </>
  );
}
