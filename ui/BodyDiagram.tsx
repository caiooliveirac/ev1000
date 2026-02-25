'use client';

import { CSSProperties, useMemo } from 'react';
import { PatientState } from '@/engine/types';

/* ─── helpers ────────────────────────────────────────────────────────── */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);

/** Map a value from [inLo, inHi] → [outLo, outHi] with clamping */
const remap = (v: number, inLo: number, inHi: number, outLo: number, outHi: number) =>
  lerp(outLo, outHi, (v - inLo) / (inHi - inLo));

type StatusColor = 'ok' | 'warn' | 'critical';
const palette: Record<StatusColor, string> = {
  ok: '#6de38e',
  warn: '#f8c05f',
  critical: '#f7766d',
};

/* ─── Derived hemodynamic "visual state" ─────────────────────────────── */

interface BodyVisuals {
  /* Heart */
  heartScale: number;        // 0.7 – 1.3 (pump/fill)
  heartColor: string;        // from CO/CI
  heartGlow: string;
  heartPulseRate: number;    // seconds per beat (CSS animation)
  lvEjection: number;        // 0-1 contractility indicator
  rvStrain: number;          // 0-1 RV overload

  /* Lungs */
  lungColor: string;         // oxygenation
  lungOpacity: number;       // consolidation / EVLW
  evlwOverlay: number;       // 0-1 fluid in lungs

  /* Arteries */
  arteryWidth: number;       // SVR → wider = more tone
  arteryColor: string;       // MAP status
  arteryPulse: number;       // pulse pressure animation speed

  /* Veins */
  venousWidth: number;       // venous return / CVP
  venousColor: string;
  venousFill: number;        // 0-1 volume state

  /* Blood volume ring */
  volumeFraction: number;    // 0-1 of expected BV
  volumeColor: string;

  /* Tissue / periphery */
  tissueColor: string;       // perfusion (DO2/VO2)
  lactateGlow: boolean;      // lactate > 4

  /* Labels */
  coText: string;
  mapText: string;
  hrText: string;
  svo2Text: string;
  evlwText: string;
  gediText: string;
  svrText: string;
  lactateText: string;
}

function deriveBodyVisuals(patient: PatientState): BodyVisuals {
  const v = patient.visible;
  const h = patient.hidden;

  // ── Heart ────────────────────────────────────────────────────
  const coNorm = clamp(v.cardiacOutput / 5.5, 0.3, 1.8);   // ~5.5 L/min "normal"
  const heartScale = remap(coNorm, 0.3, 1.2, 0.82, 1.15);
  const hrSafe = Math.max(v.hr, 40);
  const heartPulseRate = 60 / hrSafe;  // seconds per beat

  const ciStatus: StatusColor =
    v.cardiacOutput < 2.0 ? 'critical' :
    v.cardiacOutput < 3.5 ? 'warn' : 'ok';
  const heartColor = palette[ciStatus];
  const heartGlow = ciStatus === 'critical'
    ? '0 0 18px rgba(247,118,109,0.6)'
    : ciStatus === 'warn'
    ? '0 0 12px rgba(248,192,95,0.4)'
    : '0 0 8px rgba(109,227,142,0.25)';

  const lvEjection = clamp(h.contractilityLV, 0, 1);
  const rvStrain = clamp(
    (h.pulmonaryResistance - (h.basalPVR || 220)) / 600 +
    Math.max(0, h.rightAtrialPressure - 12) / 10,
    0, 1
  );

  // ── Lungs ────────────────────────────────────────────────────
  const pao2Norm = clamp((v.pao2 - 60) / 40, 0, 1); // 60-100
  const lungColor = pao2Norm > 0.5
    ? lerp(0.55, 0.88, pao2Norm).toFixed(2) // blue hue shift
    : lerp(0.3, 0.55, pao2Norm).toFixed(2);

  const evlwNorm = clamp((v.evlw - 7) / 20, 0, 1); // 7=normal, 27=severe
  const lungOpacity = lerp(0.5, 0.95, 1 - evlwNorm);
  const evlwOverlay = evlwNorm;

  // ── Arteries ─────────────────────────────────────────────────
  const svrNorm = clamp(v.svr / 1200, 0.4, 2.0);
  const arteryWidth = remap(svrNorm, 0.4, 2.0, 2.5, 6);
  const mapStatus: StatusColor =
    v.map < 55 ? 'critical' : v.map < 65 ? 'warn' : 'ok';
  const arteryColor = palette[mapStatus];
  const arteryPulse = heartPulseRate;

  // ── Veins ────────────────────────────────────────────────────
  const cvpNorm = clamp(v.cvp / 15, 0.2, 1.5);
  const venousWidth = remap(cvpNorm, 0.2, 1.5, 2, 5.5);
  const venousFill = clamp(h.bloodVolume / 5500, 0.4, 1.2);
  const cvpStatus: StatusColor =
    v.cvp > 18 ? 'critical' : v.cvp > 12 ? 'warn' : 'ok';
  const venousColor = cvpStatus === 'ok' ? '#5b8cc9' : palette[cvpStatus];

  // ── Blood volume ring ────────────────────────────────────────
  const volumeFraction = clamp(h.bloodVolume / 5000, 0.3, 1.3);
  const volStatus: StatusColor =
    h.bloodVolume < 3500 ? 'critical' :
    h.bloodVolume < 4200 ? 'warn' : 'ok';
  const volumeColor = palette[volStatus];

  // ── Tissue perfusion ─────────────────────────────────────────
  const do2Norm = clamp(v.do2 / 900, 0.2, 1.5);
  const tissueStat: StatusColor =
    v.do2 < 350 ? 'critical' : v.do2 < 550 ? 'warn' : 'ok';
  const tissueColor = palette[tissueStat];
  const lactateGlow = v.lactate > 4;

  return {
    heartScale,
    heartColor,
    heartGlow,
    heartPulseRate,
    lvEjection,
    rvStrain,
    lungColor,
    lungOpacity,
    evlwOverlay,
    arteryWidth,
    arteryColor,
    arteryPulse,
    venousWidth,
    venousColor,
    venousFill,
    volumeFraction,
    volumeColor,
    tissueColor,
    lactateGlow,
    coText: `DC ${v.cardiacOutput.toFixed(1)}`,
    mapText: `PAM ${Math.round(v.map)}`,
    hrText: `FC ${Math.round(v.hr)}`,
    svo2Text: `SvO₂ ${Math.round(v.svo2)}%`,
    evlwText: `EVLW ${v.evlw.toFixed(1)}`,
    gediText: `GEDI ${Math.round(v.gedi)}`,
    svrText: `RVS ${Math.round(v.svr)}`,
    lactateText: `Lac ${v.lactate.toFixed(1)}`,
  };
}

/* ─── Component ──────────────────────────────────────────────────────── */

interface BodyDiagramProps {
  patient: PatientState;
  style?: CSSProperties;
}

export function BodyDiagram({ patient, style }: BodyDiagramProps) {
  const vis = useMemo(() => deriveBodyVisuals(patient), [patient]);

  const pulseKeyframes = `
    @keyframes heartbeat {
      0%   { transform: translate(-50%, -50%) scale(${(vis.heartScale * 0.92).toFixed(3)}); }
      15%  { transform: translate(-50%, -50%) scale(${(vis.heartScale * 1.08).toFixed(3)}); }
      30%  { transform: translate(-50%, -50%) scale(${(vis.heartScale * 0.96).toFixed(3)}); }
      45%  { transform: translate(-50%, -50%) scale(${(vis.heartScale * 1.02).toFixed(3)}); }
      100% { transform: translate(-50%, -50%) scale(${(vis.heartScale * 0.92).toFixed(3)}); }
    }
    @keyframes arteryPulse {
      0%   { opacity: 0.6; }
      20%  { opacity: 1; }
      100% { opacity: 0.6; }
    }
    @keyframes lungBreathe {
      0%   { transform: scaleX(0.96) scaleY(0.98); }
      50%  { transform: scaleX(1.02) scaleY(1.03); }
      100% { transform: scaleX(0.96) scaleY(0.98); }
    }
    @keyframes fluidShimmer {
      0%   { opacity: 0.3; }
      50%  { opacity: 0.7; }
      100% { opacity: 0.3; }
    }
    @keyframes lactateFlash {
      0%   { opacity: 0; }
      50%  { opacity: 0.6; }
      100% { opacity: 0; }
    }
  `;

  // For volume ring — circumference of r=70
  const ringR = 70;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDash = ringCirc * clamp(vis.volumeFraction, 0, 1);

  const labelStyle: CSSProperties = {
    fontSize: 10,
    fontFamily: '"IBM Plex Mono", monospace',
    fontWeight: 600,
    letterSpacing: 0.4,
    fill: 'currentColor',
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 420,
        aspectRatio: '3 / 4',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(16,26,43,0.95) 0%, rgba(11,18,32,0.98) 100%)',
        border: '1px solid var(--panel-border)',
        borderRadius: 14,
        overflow: 'hidden',
        ...style,
      }}
    >
      <style>{pulseKeyframes}</style>

      <svg
        viewBox="0 0 300 400"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          {/* Artery gradient */}
          <linearGradient id="arteryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={vis.arteryColor} stopOpacity={0.95} />
            <stop offset="100%" stopColor={vis.arteryColor} stopOpacity={0.55} />
          </linearGradient>

          {/* Vein gradient */}
          <linearGradient id="veinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={vis.venousColor} stopOpacity={0.9} />
            <stop offset="100%" stopColor={vis.venousColor} stopOpacity={0.5} />
          </linearGradient>

          {/* Lung fluid overlay gradient */}
          <linearGradient id="evlwGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#46c2ff" stopOpacity={vis.evlwOverlay * 0.7} />
            <stop offset={`${clamp(vis.evlwOverlay * 100, 0, 100)}%`} stopColor="#46c2ff" stopOpacity={vis.evlwOverlay * 0.4} />
            <stop offset="100%" stopColor="#46c2ff" stopOpacity={0} />
          </linearGradient>

          {/* Heart glow filter */}
          <filter id="heartGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          </filter>

          {/* Tissue glow */}
          <filter id="tissueGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>

        {/* ═══ BODY SILHOUETTE (subtle) ═══ */}
        <ellipse cx="150" cy="85" rx="32" ry="36" fill="none" stroke="#1e3352" strokeWidth="1.2" opacity={0.5} />
        {/* Torso */}
        <path
          d="M 105 115 Q 90 140 88 190 Q 87 240 95 290 L 110 340 L 130 340 L 135 295 
             Q 140 340 150 340 Q 160 340 165 295 L 170 340 L 190 340 L 205 290 
             Q 213 240 212 190 Q 210 140 195 115 Z"
          fill="none"
          stroke="#1e3352"
          strokeWidth="1"
          opacity={0.35}
        />

        {/* ═══ VENOUS SYSTEM (right side — returning blood) ═══ */}
        <g opacity={0.85}>
          {/* Superior vena cava */}
          <path
            d="M 175 100 Q 172 115 168 130 Q 165 145 162 155"
            fill="none"
            stroke="url(#veinGrad)"
            strokeWidth={vis.venousWidth}
            strokeLinecap="round"
            opacity={clamp(vis.venousFill, 0.5, 1)}
          />
          {/* Inferior vena cava */}
          <path
            d="M 162 175 Q 163 210 165 250 Q 167 280 170 310"
            fill="none"
            stroke="url(#veinGrad)"
            strokeWidth={vis.venousWidth * 0.9}
            strokeLinecap="round"
            opacity={clamp(vis.venousFill, 0.5, 1)}
          />
          {/* IVC to RA */}
          <path
            d="M 162 155 L 162 175"
            fill="none"
            stroke="url(#veinGrad)"
            strokeWidth={vis.venousWidth * 0.85}
            strokeLinecap="round"
          />
        </g>

        {/* ═══ ARTERIAL SYSTEM (left side — outgoing blood) ═══ */}
        <g>
          {/* Aortic arch */}
          <path
            d="M 140 155 Q 138 140 135 125 Q 130 108 125 100"
            fill="none"
            stroke="url(#arteryGrad)"
            strokeWidth={vis.arteryWidth}
            strokeLinecap="round"
            style={{
              animation: `arteryPulse ${vis.arteryPulse}s ease-in-out infinite`,
            }}
          />
          {/* Descending aorta */}
          <path
            d="M 140 175 Q 138 210 135 250 Q 132 280 130 310"
            fill="none"
            stroke="url(#arteryGrad)"
            strokeWidth={vis.arteryWidth * 0.85}
            strokeLinecap="round"
            style={{
              animation: `arteryPulse ${vis.arteryPulse}s ease-in-out infinite`,
              animationDelay: '0.08s',
            }}
          />
          {/* Aorta trunk */}
          <path
            d="M 140 155 L 140 175"
            fill="none"
            stroke="url(#arteryGrad)"
            strokeWidth={vis.arteryWidth * 0.9}
            strokeLinecap="round"
            style={{
              animation: `arteryPulse ${vis.arteryPulse}s ease-in-out infinite`,
              animationDelay: '0.04s',
            }}
          />
        </g>

        {/* ═══ PULMONARY ARTERIES ═══ */}
        <g opacity={0.7}>
          {/* Right pulmonary artery → right lung */}
          <path
            d="M 155 152 Q 148 138 130 132 Q 118 128 110 130"
            fill="none"
            stroke="#6b8fc2"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* Left pulmonary artery → left lung */}
          <path
            d="M 155 152 Q 162 138 175 132 Q 185 128 192 130"
            fill="none"
            stroke="#6b8fc2"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </g>

        {/* ═══ LUNGS ═══ */}
        {/* Right lung */}
        <g style={{ transformOrigin: '112px 155px', animation: 'lungBreathe 4s ease-in-out infinite' }}>
          <path
            d="M 92 120 Q 85 140 85 165 Q 85 190 95 200 Q 110 210 125 195 Q 133 180 133 155 Q 133 130 125 120 Q 115 112 92 120 Z"
            fill={`hsla(210, 55%, ${lerp(25, 50, clamp((patient.visible.pao2 - 50) / 50, 0, 1))}%, ${vis.lungOpacity})`}
            stroke="#3a6da8"
            strokeWidth="1.2"
          />
          {/* EVLW fluid overlay */}
          <path
            d="M 92 120 Q 85 140 85 165 Q 85 190 95 200 Q 110 210 125 195 Q 133 180 133 155 Q 133 130 125 120 Q 115 112 92 120 Z"
            fill="url(#evlwGrad)"
            opacity={vis.evlwOverlay > 0.1 ? 1 : 0}
            style={{
              animation: vis.evlwOverlay > 0.3 ? 'fluidShimmer 2.5s ease-in-out infinite' : 'none',
            }}
          />
        </g>

        {/* Left lung */}
        <g style={{ transformOrigin: '190px 155px', animation: 'lungBreathe 4s ease-in-out infinite', animationDelay: '0.3s' }}>
          <path
            d="M 210 120 Q 218 140 218 165 Q 218 190 208 200 Q 193 210 178 195 Q 170 180 170 155 Q 170 130 178 120 Q 188 112 210 120 Z"
            fill={`hsla(210, 55%, ${lerp(25, 50, clamp((patient.visible.pao2 - 50) / 50, 0, 1))}%, ${vis.lungOpacity})`}
            stroke="#3a6da8"
            strokeWidth="1.2"
          />
          <path
            d="M 210 120 Q 218 140 218 165 Q 218 190 208 200 Q 193 210 178 195 Q 170 180 170 155 Q 170 130 178 120 Q 188 112 210 120 Z"
            fill="url(#evlwGrad)"
            opacity={vis.evlwOverlay > 0.1 ? 1 : 0}
            style={{
              animation: vis.evlwOverlay > 0.3 ? 'fluidShimmer 2.5s ease-in-out infinite' : 'none',
              animationDelay: '0.4s',
            }}
          />
        </g>

        {/* ═══ HEART ═══ */}
        <g
          style={{
            transformOrigin: '150px 165px',
            position: 'absolute',
            left: '50%',
            top: '50%',
            animation: `heartbeat ${vis.heartPulseRate}s ease-in-out infinite`,
          }}
        >
          {/* Heart glow background */}
          <ellipse
            cx="150" cy="165"
            rx="22" ry="20"
            fill={vis.heartColor}
            opacity={0.15}
            filter="url(#heartGlow)"
          />

          {/* Heart shape — stylized */}
          <path
            d="M 150 180 
               Q 135 175 132 162 Q 130 152 136 147 Q 142 142 150 150 
               Q 158 142 164 147 Q 170 152 168 162 Q 165 175 150 180 Z"
            fill={vis.heartColor}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.8"
            opacity={0.9}
          />

          {/* LV indicator — inner chamber */}
          <ellipse
            cx="147" cy="165"
            rx={lerp(4, 7, vis.lvEjection)}
            ry={lerp(5, 8, vis.lvEjection)}
            fill="rgba(255,255,255,0.12)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.5"
          />

          {/* RV strain indicator */}
          {vis.rvStrain > 0.3 && (
            <ellipse
              cx="157" cy="163"
              rx={lerp(3, 6, vis.rvStrain)}
              ry={lerp(4, 7, vis.rvStrain)}
              fill="none"
              stroke={vis.rvStrain > 0.6 ? palette.critical : palette.warn}
              strokeWidth="1"
              opacity={lerp(0.3, 0.8, vis.rvStrain)}
              strokeDasharray="2 2"
            />
          )}
        </g>

        {/* ═══ TISSUE PERFUSION (peripheral) ═══ */}
        <g>
          {/* Left arm/tissue */}
          <ellipse cx="82" cy="240" rx="14" ry="20"
            fill={vis.tissueColor} opacity={0.12}
            filter="url(#tissueGlow)"
          />
          {/* Right arm/tissue */}
          <ellipse cx="218" cy="240" rx="14" ry="20"
            fill={vis.tissueColor} opacity={0.12}
            filter="url(#tissueGlow)"
          />
          {/* Lower body */}
          <ellipse cx="150" cy="320" rx="30" ry="18"
            fill={vis.tissueColor} opacity={0.1}
            filter="url(#tissueGlow)"
          />

          {/* Lactate flash */}
          {vis.lactateGlow && (
            <g style={{ animation: 'lactateFlash 1.5s ease-in-out infinite' }}>
              <circle cx="82" cy="240" r="18" fill={palette.critical} opacity={0.15} />
              <circle cx="218" cy="240" r="18" fill={palette.critical} opacity={0.15} />
              <circle cx="150" cy="320" r="22" fill={palette.critical} opacity={0.1} />
            </g>
          )}
        </g>

        {/* ═══ BLOOD VOLUME RING ═══ */}
        <circle
          cx="150" cy="165"
          r={ringR}
          fill="none"
          stroke="#1e3352"
          strokeWidth="3"
          opacity={0.3}
        />
        <circle
          cx="150" cy="165"
          r={ringR}
          fill="none"
          stroke={vis.volumeColor}
          strokeWidth="3"
          strokeDasharray={`${ringDash} ${ringCirc}`}
          strokeDashoffset={ringCirc * 0.25}
          strokeLinecap="round"
          opacity={0.6}
          style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s ease' }}
        />

        {/* ═══ METRIC LABELS ═══ */}
        {/* Heart region */}
        <text x="150" y="198" textAnchor="middle" style={labelStyle} fill={vis.heartColor}>
          {vis.coText}
        </text>
        <text x="150" y="209" textAnchor="middle" style={{ ...labelStyle, fontSize: 8 }} fill="#9db0cc">
          {vis.hrText}
        </text>

        {/* MAP — artery side */}
        <text x="102" y="280" textAnchor="middle" style={labelStyle} fill={vis.arteryColor}>
          {vis.mapText}
        </text>
        <text x="102" y="291" textAnchor="middle" style={{ ...labelStyle, fontSize: 8 }} fill="#9db0cc">
          {vis.svrText}
        </text>

        {/* Venous side */}
        <text x="198" y="280" textAnchor="middle" style={labelStyle} fill={vis.venousColor}>
          {vis.gediText}
        </text>

        {/* Lung labels */}
        <text x="109" y="160" textAnchor="middle" style={{ ...labelStyle, fontSize: 8.5 }} fill="#8ab4d6">
          {vis.evlwText}
        </text>
        <text x="192" y="160" textAnchor="middle" style={{ ...labelStyle, fontSize: 8.5 }} fill="#8ab4d6">
          {vis.svo2Text}
        </text>

        {/* Tissue — lactate */}
        <text x="150" y="340" textAnchor="middle"
          style={labelStyle}
          fill={vis.lactateGlow ? palette.critical : '#9db0cc'}
        >
          {vis.lactateText}
        </text>

        {/* Volume status label at top of ring */}
        <text x="150" y="88" textAnchor="middle" style={{ ...labelStyle, fontSize: 8 }} fill={vis.volumeColor}>
          {`Vol ${Math.round(patient.hidden.bloodVolume)} mL`}
        </text>

        {/* ═══ LEGEND ═══ */}
        <g transform="translate(10, 375)">
          <circle cx="5" cy="0" r="3" fill={palette.ok} opacity={0.7} />
          <text x="12" y="3" style={{ fontSize: 7.5, fill: '#6a8eb8' }}>Adequado</text>
          <circle cx="60" cy="0" r="3" fill={palette.warn} opacity={0.7} />
          <text x="67" y="3" style={{ fontSize: 7.5, fill: '#6a8eb8' }}>Alerta</text>
          <circle cx="105" cy="0" r="3" fill={palette.critical} opacity={0.7} />
          <text x="112" y="3" style={{ fontSize: 7.5, fill: '#6a8eb8' }}>Critico</text>
        </g>
      </svg>

      {/* Title bar */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          right: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: 11, color: '#6a8eb8', letterSpacing: 0.5, fontWeight: 600 }}>
          DIAGRAMA HEMODINAMICO
        </span>
      </div>
    </div>
  );
}
