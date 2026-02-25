/**
 * Silhouette — faint body outline (head + torso + arms).
 * Pure presentational, no dynamic props.
 */

export function Silhouette() {
  const s = '#1a2e4a'; // stroke color
  return (
    <g opacity={0.35}>
      {/* Head */}
      <ellipse cx={170} cy={62} rx={28} ry={32} fill="none" stroke={s} strokeWidth={1} />
      {/* Torso */}
      <path
        d="M125 90 Q108 115 104 165 Q102 220 108 275 L122 340 L140 345 L148 300
           Q155 345 170 348 Q185 345 192 300 L200 345 L218 340 L232 275
           Q238 220 236 165 Q232 115 215 90Z"
        fill="none" stroke={s} strokeWidth={0.8} opacity={0.85}
      />
      {/* Arms */}
      <path d="M125 92 Q90 105 72 145 Q60 180 65 220 Q68 252 74 270"
        fill="none" stroke={s} strokeWidth={0.7} opacity={0.55} />
      <path d="M215 92 Q250 105 268 145 Q280 180 275 220 Q272 252 266 270"
        fill="none" stroke={s} strokeWidth={0.7} opacity={0.55} />
    </g>
  );
}
