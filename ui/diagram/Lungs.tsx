/**
 * Lungs — breathing animation, dynamic color (healthy pink → congested gray-blue),
 * EVLW fluid overlay with shimmer.
 *
 * Right lung shows EVLW badge, left shows PaO₂.
 * Colors shift: healthy = translucent rose; edema = denser blue-gray; ARDS = dim.
 */

import { lerp, clamp, severityAlpha } from './colors';
import type { BodyVisuals } from './visuals';

interface Props { vis: BodyVisuals }

/* Right lung path */
const RL = `M100 112 Q90 132 88 158 Q88 185 98 198 Q115 212 132 195
            Q142 178 142 155 Q142 130 132 118 Q122 108 100 112Z`;
/* Left lung path */
const LL = `M242 112 Q252 132 254 158 Q254 185 244 198 Q227 212 210 195
            Q200 178 200 155 Q200 130 210 118 Q220 108 242 112Z`;

export function Lungs({ vis }: Props) {
  // Healthy = translucent rose-pink; edema = blue-gray-white
  const hue = lerp(340, 210, vis.evlwFill);     // rose → blue
  const sat = lerp(35, 45, vis.evlwFill);
  const light = lerp(48, 30, vis.evlwFill);
  const alpha = lerp(0.52, 0.82, vis.evlwFill);
  const fill = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
  const stroke = severityAlpha(vis.pao2Severity, 0.55);

  const shimmer = vis.evlwFill > 0.25;

  return (
    <>
      {/* Right lung */}
      <g style={{ transformOrigin: '115px 155px', animation: 'lungBreathe 4.2s ease-in-out infinite' }}>
        <path d={RL} fill={fill} stroke={stroke} strokeWidth={1.2} />
        {/* Bronchi — faint internal detail */}
        <path d="M115 120 L115 165 M115 135 L105 145 M115 150 L125 160"
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={0.6} />
        {/* EVLW fluid overlay */}
        {vis.evlwFill > 0.08 && (
          <path d={RL} fill="url(#evlwFluid)" opacity={1}
            style={{ animation: shimmer ? 'fluidShimmer 2.8s ease-in-out infinite' : 'none' }} />
        )}
      </g>

      {/* Left lung */}
      <g style={{ transformOrigin: '222px 155px', animation: 'lungBreathe 4.2s ease-in-out infinite', animationDelay: '0.35s' }}>
        <path d={LL} fill={fill} stroke={stroke} strokeWidth={1.2} />
        <path d="M227 120 L227 165 M227 135 L237 145 M227 150 L217 160"
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={0.6} />
        {vis.evlwFill > 0.08 && (
          <path d={LL} fill="url(#evlwFluid)" opacity={1}
            style={{ animation: shimmer ? 'fluidShimmer 2.8s ease-in-out infinite' : 'none', animationDelay: '0.4s' }} />
        )}
      </g>
    </>
  );
}

/** SVG <defs> for lung fluid gradient. */
export function LungDefs({ evlwFill }: { evlwFill: number }) {
  return (
    <linearGradient id="evlwFluid" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stopColor="#3ba8e8" stopOpacity={evlwFill * 0.65} />
      <stop offset={`${clamp(evlwFill * 100, 5, 100)}%`} stopColor="#3ba8e8" stopOpacity={evlwFill * 0.25} />
      <stop offset="100%" stopColor="#3ba8e8" stopOpacity={0} />
    </linearGradient>
  );
}
