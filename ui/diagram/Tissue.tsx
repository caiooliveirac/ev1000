/**
 * Tissue — peripheral perfusion glow + lactate flash overlay.
 */

import { severityColor } from './colors';
import type { BodyVisuals } from './visuals';

interface Props { vis: BodyVisuals }

export function Tissue({ vis }: Props) {
  const c = severityColor(vis.do2Severity);
  return (
    <g>
      {/* Diffuse perfusion glow — arms + lower body */}
      <ellipse cx={72} cy={215} rx={16} ry={24} fill={c} opacity={0.08} filter="url(#glowTissue)" />
      <ellipse cx={268} cy={215} rx={16} ry={24} fill={c} opacity={0.08} filter="url(#glowTissue)" />
      <ellipse cx={170} cy={340} rx={35} ry={22} fill={c} opacity={0.06} filter="url(#glowTissue)" />

      {/* Lactate flash — red warning in peripheral tissues when Lac > 4 */}
      {vis.lactateFlash && (
        <g style={{ animation: 'lactateFlash 1.8s ease-in-out infinite' }}>
          <circle cx={72} cy={215} r={20} fill="#f7766d" opacity={0.12} />
          <circle cx={268} cy={215} r={20} fill="#f7766d" opacity={0.12} />
          <circle cx={170} cy={340} r={28} fill="#f7766d" opacity={0.08} />
        </g>
      )}
    </g>
  );
}
