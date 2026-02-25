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
/* Anterior view: arteries exit LV (viewer's right ~185), veins enter RA (viewer's left ~150) */
const P = {
  aortaUp:   'M185 168 Q188 150 192 130 Q196 112 200 95',
  aortaRoot: 'M185 168 L185 195',
  aortaDown: 'M185 195 Q188 230 192 268 Q195 300 198 330',
  svcUp:     'M140 82 Q142 100 145 118 Q148 132 150 142',
  svcRA:     'M150 142 L152 156',
  ivcDown:   'M152 200 Q150 235 147 270 Q145 300 142 330',
  ivcRA:     'M152 185 L152 200',
  paRight:   'M165 155 Q155 135 145 127 Q130 122 118 125',
  paLeft:    'M165 155 Q175 135 195 127 Q210 122 225 125',
  pvRight:   'M122 175 Q135 180 155 176 Q165 174 170 172',
  pvLeft:    'M222 175 Q208 180 195 176 Q185 174 178 172',
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
      {/* Deep shadow — outer glow for depth */}
      <path d={d} fill="none"
        stroke="rgba(0,0,0,0.18)" strokeWidth={width + 5}
        strokeLinecap="round" opacity={opacity * 0.2} />
      {/* Shadow (wider, darker) */}
      <path d={d} fill="none"
        stroke="rgba(0,0,0,0.35)" strokeWidth={width + 2.5}
        strokeLinecap="round" opacity={opacity * 0.45} />
      {/* Main tube */}
      <path d={d} fill="none"
        stroke={`url(#${gradId})`} strokeWidth={width}
        strokeLinecap="round" opacity={opacity} />
      {/* Primary highlight (specular) */}
      <path d={d} fill="none"
        stroke="rgba(255,255,255,0.2)" strokeWidth={Math.max(width * 0.38, 1.0)}
        strokeLinecap="round" opacity={opacity * 0.75} />
      {/* Fine rim light */}
      <path d={d} fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth={Math.max(width * 0.15, 0.5)}
        strokeLinecap="round" opacity={opacity * 0.5} />
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
        <animateMotion dur={`${pr * 3}s`} repeatCount="indefinite" path={P.svcUp + ' L152 156'} />
      </circle>
      <circle r={1.5} fill={veinColor} opacity={0.5}>
        <animateMotion dur={`${pr * 4}s`} repeatCount="indefinite"
          path="M142 330 Q145 300 147 270 Q150 235 152 200 L152 185" />
      </circle>

      {/* Pulmonary */}
      <circle r={1.5} fill={veinColor} opacity={0.55}>
        <animateMotion dur={`${pr * 2}s`} repeatCount="indefinite" path={P.paRight} />
      </circle>
      <circle r={1.5} fill={arteryColor} opacity={0.5}>
        <animateMotion dur={`${pr * 2.2}s`} repeatCount="indefinite" path={P.pvRight} />
      </circle>

      {/* ── FLOW DIRECTION ARROWS ── */}
      {/* Arterial: up on right side */}
      <path d="M196 108 L192 100 L200 100Z" fill={arteryColor} opacity={0.5} />
      {/* Venous: down on left side */}
      <path d="M147 118 L143 126 L151 126Z" fill={veinColor} opacity={0.5} />
      {/* PA arrows to lungs */}
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
