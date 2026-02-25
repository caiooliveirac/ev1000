/**
 * Vessels — 3D-looking arteries, veins, and pulmonary circulation.
 *
 * 3D tube effect: Each vessel is drawn as a wide dark path (shadow),
 * the main colored path, and a narrow highlight path on top.
 * This creates a convincing cylindrical illusion in SVG.
 *
 * - Arteries: left side, width ~ SVR (vasoconstriction visible)
 * - Veins: right side, width ~ CVP (distension visible)
 * - Pulmonary: connecting RV → lungs → LA
 * - Flow particles: red dots in arteries, blue in veins
 */

import { clamp } from './colors';
import type { BodyVisuals } from './visuals';

interface Props {
  vis: BodyVisuals;
  arteryColor: string;
  veinColor: string;
}

/* ── Path definitions (reused for shadow / main / highlight layers) ── */
const P = {
  aortaUp:   'M155 168 Q152 150 148 130 Q144 112 140 95',
  aortaRoot: 'M155 168 L155 195',
  aortaDown: 'M155 195 Q152 230 148 268 Q145 300 142 330',
  svcUp:     'M200 82 Q198 100 195 118 Q192 132 190 142',
  svcRA:     'M190 142 L188 156',
  ivcDown:   'M188 200 Q190 235 193 270 Q195 300 198 330',
  ivcRA:     'M188 185 L188 200',
  paRight:   'M175 155 Q165 135 145 127 Q130 122 118 125',
  paLeft:    'M175 155 Q185 135 200 127 Q215 122 225 125',
  pvRight:   'M122 175 Q135 180 150 178 Q158 176 162 172',
  pvLeft:    'M222 175 Q208 180 195 178 Q185 176 180 172',
};

/**
 * Renders a 3D-tube vessel: shadow layer → main → highlight.
 * The highlight is a thinner, brighter stroke offset toward the "top" of the tube.
 */
function Tube3D({ d, width, gradId, opacity = 0.85, pulse, pulseRate, delay }:
  { d: string; width: number; gradId: string; opacity?: number;
    pulse?: boolean; pulseRate?: number; delay?: string }) {
  const style = pulse && pulseRate
    ? { animation: `arteryPulse ${pulseRate}s ease-in-out infinite`, animationDelay: delay ?? '0s' }
    : undefined;
  return (
    <g style={style}>
      {/* Shadow (wider, darker) */}
      <path d={d} fill="none"
        stroke="rgba(0,0,0,0.3)" strokeWidth={width + 2}
        strokeLinecap="round" opacity={opacity * 0.4} />
      {/* Main tube */}
      <path d={d} fill="none"
        stroke={`url(#${gradId})`} strokeWidth={width}
        strokeLinecap="round" opacity={opacity} />
      {/* Highlight (specular) */}
      <path d={d} fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth={Math.max(width * 0.3, 0.8)}
        strokeLinecap="round" opacity={opacity * 0.7} />
    </g>
  );
}

export function Vessels({ vis, arteryColor, veinColor }: Props) {
  const aw = vis.arteryWidth;
  const vw = vis.veinWidth;
  const pw = vis.pulmonaryWidth;
  const pr = vis.heartPulseRate;
  const vFill = clamp(vis.venousFill, 0.45, 1);

  return (
    <>
      {/* ── ARTERIES (left side) ── */}
      <Tube3D d={P.aortaUp}   width={aw}       gradId="artG" pulse pulseRate={pr} />
      <Tube3D d={P.aortaRoot} width={aw * 0.9}  gradId="artG" pulse pulseRate={pr} delay="0.03s" />
      <Tube3D d={P.aortaDown} width={aw * 0.82} gradId="artG" pulse pulseRate={pr} delay="0.06s" />

      {/* ── VEINS (right side) ── */}
      <Tube3D d={P.svcUp}  width={vw}        gradId="venG" opacity={vFill} />
      <Tube3D d={P.svcRA}  width={vw * 0.9}  gradId="venG" opacity={0.8} />
      <Tube3D d={P.ivcDown} width={vw * 0.85} gradId="venG" opacity={vFill * 0.9} />
      <Tube3D d={P.ivcRA}  width={vw * 0.8}  gradId="venG" opacity={0.7} />

      {/* ── PULMONARY ARTERIES (RV → lungs, deoxygenated) ── */}
      <Tube3D d={P.paRight} width={pw} gradId="paG" opacity={0.75} />
      <Tube3D d={P.paLeft}  width={pw} gradId="paG" opacity={0.75} />

      {/* ── PULMONARY VEINS (lungs → LA, oxygenated) ── */}
      <Tube3D d={P.pvRight} width={2.2} gradId="pvG" opacity={0.6} />
      <Tube3D d={P.pvLeft}  width={2.2} gradId="pvG" opacity={0.6} />

      {/* ── FLOW PARTICLES ── */}
      {/* Arterial (fast, red) */}
      <circle r={2} fill={arteryColor} opacity={0.7}>
        <animateMotion dur={`${pr * 1.5}s`} repeatCount="indefinite" path={P.aortaUp} />
      </circle>
      <circle r={1.8} fill={arteryColor} opacity={0.6}>
        <animateMotion dur={`${pr * 2.5}s`} repeatCount="indefinite" path={P.aortaDown} />
      </circle>

      {/* Venous (slow, blue) */}
      <circle r={1.8} fill={veinColor} opacity={0.6}>
        <animateMotion dur={`${pr * 3}s`} repeatCount="indefinite" path={P.svcUp + ' L188 156'} />
      </circle>
      <circle r={1.5} fill={veinColor} opacity={0.5}>
        <animateMotion dur={`${pr * 4}s`} repeatCount="indefinite"
          path="M198 330 Q195 300 193 270 Q190 235 188 200 L188 185" />
      </circle>

      {/* Pulmonary */}
      <circle r={1.5} fill={veinColor} opacity={0.55}>
        <animateMotion dur={`${pr * 2}s`} repeatCount="indefinite" path={P.paRight} />
      </circle>
      <circle r={1.5} fill={arteryColor} opacity={0.5}>
        <animateMotion dur={`${pr * 2.2}s`} repeatCount="indefinite" path={P.pvRight} />
      </circle>

      {/* ── FLOW DIRECTION ARROWS ── */}
      <path d="M148 108 L144 100 L152 100Z" fill={arteryColor} opacity={0.5} />
      <path d="M193 118 L189 126 L197 126Z" fill={veinColor} opacity={0.5} />
      <path d="M130 123 L126 128 L132 131Z" fill={veinColor} opacity={0.4} />
      <path d="M215 123 L220 128 L214 131Z" fill={veinColor} opacity={0.4} />
    </>
  );
}

/**
 * SVG <defs> for vessel gradients — 3D tube appearance.
 * Uses perpendicular-to-flow gradients for the cylindrical illusion.
 */
export function VesselDefs({ arteryColor, veinColor }: { arteryColor: string; veinColor: string }) {
  return (
    <>
      {/* Artery — vertical gradient (longitudinal) + bright center */}
      <linearGradient id="artG" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={arteryColor} stopOpacity={0.5} />
        <stop offset="50%" stopColor={arteryColor} stopOpacity={0.95} />
        <stop offset="100%" stopColor={arteryColor} stopOpacity={0.5} />
      </linearGradient>
      {/* Vein — same 3D approach */}
      <linearGradient id="venG" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={veinColor} stopOpacity={0.4} />
        <stop offset="50%" stopColor={veinColor} stopOpacity={0.9} />
        <stop offset="100%" stopColor={veinColor} stopOpacity={0.4} />
      </linearGradient>
      {/* Pulmonary artery */}
      <linearGradient id="paG" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={veinColor} stopOpacity={0.35} />
        <stop offset="50%" stopColor="#4a7aaa" stopOpacity={0.8} />
        <stop offset="100%" stopColor={veinColor} stopOpacity={0.35} />
      </linearGradient>
      {/* Pulmonary vein */}
      <linearGradient id="pvG" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={arteryColor} stopOpacity={0.35} />
        <stop offset="50%" stopColor="#c45555" stopOpacity={0.7} />
        <stop offset="100%" stopColor={arteryColor} stopOpacity={0.35} />
      </linearGradient>
    </>
  );
}
