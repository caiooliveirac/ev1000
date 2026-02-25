/**
 * VolumeRing — circular gauge around the torso showing blood volume fraction.
 */

import { clamp, severityColor } from './colors';
import type { BodyVisuals } from './visuals';

interface Props { vis: BodyVisuals }

export function VolumeRing({ vis }: Props) {
  const R = 88;
  const C = 2 * Math.PI * R;
  const dash = C * clamp(vis.bvFraction, 0, 1);

  return (
    <g>
      <circle cx={170} cy={175} r={R} fill="none" stroke="#15253d" strokeWidth={3.5} opacity={0.35} />
      <circle cx={170} cy={175} r={R}
        fill="none"
        stroke={severityColor(vis.bvSeverity)}
        strokeWidth={3.5}
        strokeDasharray={`${dash} ${C}`}
        strokeDashoffset={C * 0.25}
        strokeLinecap="round"
        opacity={0.55}
        style={{ transition: 'stroke-dasharray 1.2s ease, stroke 0.6s ease' }}
      />
    </g>
  );
}
