'use client';

import { CSSProperties, useMemo } from 'react';
import { PatientState } from '@/engine/types';

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const remap = (v: number, inLo: number, inHi: number, outLo: number, outHi: number) =>
  lerp(outLo, outHi, (v - inLo) / (inHi - inLo));

/** Continuous color interpolation green→yellow→red based on 0-1 severity */
const severityColor = (severity: number): string => {
  const s = clamp(severity, 0, 1);
  if (s < 0.5) {
    const r = Math.round(lerp(109, 248, s * 2));
    const g = Math.round(lerp(227, 192, s * 2));
    const b = Math.round(lerp(142, 95, s * 2));
    return `rgb(${r},${g},${b})`;
  }
  const t = (s - 0.5) * 2;
  const r = Math.round(lerp(248, 247, t));
  const g = Math.round(lerp(192, 118, t));
  const b = Math.round(lerp(95, 109, t));
  return `rgb(${r},${g},${b})`;
};

const severityAlpha = (severity: number, baseAlpha: number = 0.5): string => {
  const s = clamp(severity, 0, 1);
  if (s < 0.5) {
    const r = Math.round(lerp(109, 248, s * 2));
    const g = Math.round(lerp(227, 192, s * 2));
    const b = Math.round(lerp(142, 95, s * 2));
    return `rgba(${r},${g},${b},${baseAlpha})`;
  }
  const t = (s - 0.5) * 2;
  const r = Math.round(lerp(248, 247, t));
  const g = Math.round(lerp(192, 118, t));
  const b = Math.round(lerp(95, 109, t));
  return `rgba(${r},${g},${b},${baseAlpha})`;
};

/* ═══════════════════════════════════════════════════════════════════════
   Derived visual state from engine PatientState
   ═══════════════════════════════════════════════════════════════════════ */

interface BodyVisuals {
  // Heart
  heartPulseRate: number;
  heartScale: number;
  coSeverity: number;
  lvEjection: number;
  rvStrain: number;
  rvDilation: number;
  lvColor: string;
  rvColor: string;

  // Lungs
  lungBrightness: number;
  evlwFill: number;
  pao2Severity: number;

  // Arteries
  arteryWidth: number;
  mapSeverity: number;

  // Veins
  veinWidth: number;
  cvpSeverity: number;
  venousFill: number;

  // Pulmonary arteries
  pulmonaryWidth: number;
  pvrSeverity: number;

  // Blood volume
  bvFraction: number;
  bvSeverity: number;

  // Tissue perfusion
  do2Severity: number;
  lactateSeverity: number;
  lactateFlash: boolean;

  // Oxygenation
  svo2Severity: number;
  sao2Brightness: number;
}

function deriveVisuals(p: PatientState): BodyVisuals {
  const v = p.visible;
  const h = p.hidden;
  const hrSafe = Math.max(v.hr, 35);

  // Heart
  const coNorm = clamp(v.cardiacOutput / 5.5, 0.2, 1.5);
  const coSeverity = clamp(1 - coNorm, 0, 1);
  const heartScale = remap(coNorm, 0.2, 1.0, 0.85, 1.12);
  const lvEjection = clamp(h.contractilityLV, 0, 1);
  const rvStrain = clamp(
    (h.pulmonaryResistance - (h.basalPVR || 220)) / 800 +
    Math.max(0, h.rightAtrialPressure - 12) / 12,
    0, 1
  );
  const rvDilation = clamp(rvStrain * 0.8, 0, 0.8);

  // Lungs
  const pao2Severity = clamp(1 - (v.pao2 - 50) / 50, 0, 1);
  const lungBrightness = lerp(0.5, 0.2, clamp((v.evlw - 7) / 22, 0, 1));
  const evlwFill = clamp((v.evlw - 7) / 22, 0, 1);

  // Arteries
  const svrNorm = clamp(v.svr / 1200, 0.3, 2.2);
  const arteryWidth = remap(svrNorm, 0.3, 2.2, 2.0, 6.5);
  const mapSeverity = v.map < 55 ? 1 : v.map < 65 ? remap(v.map, 55, 65, 1, 0.5) :
    v.map <= 100 ? remap(v.map, 65, 100, 0.5, 0) : clamp((v.map - 100) / 50, 0, 0.6);

  // Veins
  const cvpSeverity = v.cvp > 18 ? 1 : v.cvp > 12 ? remap(v.cvp, 12, 18, 0.4, 1) :
    v.cvp < 4 ? remap(v.cvp, 0, 4, 0.8, 0.4) : remap(v.cvp, 4, 12, 0.4, 0);
  const veinWidth = remap(clamp(v.cvp / 18, 0.15, 1.5), 0.15, 1.5, 1.8, 6);
  const venousFill = clamp(h.bloodVolume / 5500, 0.3, 1.2);

  // Pulmonary
  const pvrNorm = clamp(h.pulmonaryResistance / 500, 0.3, 3);
  const pulmonaryWidth = remap(pvrNorm, 0.3, 3, 2, 5);
  const pvrSeverity = clamp((h.pulmonaryResistance - 250) / 700, 0, 1);

  // Blood volume
  const bvFraction = clamp(h.bloodVolume / 5000, 0.25, 1.3);
  const bvSeverity = h.bloodVolume < 3500 ? 1 : h.bloodVolume < 4200 ?
    remap(h.bloodVolume, 3500, 4200, 1, 0.4) : 0;

  // Tissue & lactate
  const do2Severity = v.do2 < 350 ? 1 : v.do2 < 550 ? remap(v.do2, 350, 550, 1, 0.4) : 0;
  const lactateSeverity = v.lactate > 8 ? 1 : v.lactate > 4 ? remap(v.lactate, 4, 8, 0.6, 1) :
    v.lactate > 2 ? remap(v.lactate, 2, 4, 0, 0.6) : 0;
  const lactateFlash = v.lactate > 4;

  // SvO2 & SaO2
  const svo2Severity = v.svo2 < 50 ? 1 : v.svo2 < 65 ? remap(v.svo2, 50, 65, 1, 0.4) : 0;
  const sao2Brightness = clamp((v.sao2 - 85) / 13, 0, 1);

  return {
    heartPulseRate: 60 / hrSafe,
    heartScale, coSeverity, lvEjection, rvStrain, rvDilation,
    lvColor: severityColor(coSeverity),
    rvColor: rvStrain > 0.3 ? severityColor(rvStrain) : severityColor(coSeverity),
    lungBrightness, evlwFill, pao2Severity,
    arteryWidth, mapSeverity,
    veinWidth, cvpSeverity, venousFill,
    pulmonaryWidth, pvrSeverity,
    bvFraction, bvSeverity,
    do2Severity, lactateSeverity, lactateFlash,
    svo2Severity, sao2Brightness,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-component: Metric badge (transparent, color-coded)
   ═══════════════════════════════════════════════════════════════════════ */

interface BadgeProps {
  x: number;
  y: number;
  label: string;
  value: string;
  unit?: string;
  severity: number;
  anchor?: 'start' | 'middle' | 'end';
  size?: 'sm' | 'md';
}

function MetricBadge({ x, y, label, value, unit, severity, anchor = 'middle', size = 'md' }: BadgeProps) {
  const fontSize = size === 'sm' ? 7.5 : 9;
  const valueFontSize = size === 'sm' ? 9 : 11.5;
  const color = severityColor(severity);
  const bgColor = severityAlpha(severity, 0.08);
  const borderColor = severityAlpha(severity, 0.25);

  const textLen = `${label} ${value}${unit ? ' ' + unit : ''}`.length;
  const w = Math.max(textLen * 5.2 + 12, 42);
  const h = size === 'sm' ? 22 : 28;
  const rx = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;

  return (
    <g>
      <rect
        x={rx} y={y - h / 2 - 1}
        width={w} height={h} rx={4} ry={4}
        fill={bgColor} stroke={borderColor} strokeWidth={0.6}
      />
      <text
        x={anchor === 'start' ? rx + 5 : anchor === 'end' ? x - 5 : x}
        y={y - 3}
        textAnchor={anchor === 'start' ? 'start' : anchor === 'end' ? 'end' : 'middle'}
        style={{
          fontSize,
          fontFamily: '"IBM Plex Mono", monospace',
          fontWeight: 500,
          letterSpacing: 0.3,
          fill: 'rgba(157,176,204,0.8)',
        }}
      >
        {label}
      </text>
      <text
        x={anchor === 'start' ? rx + 5 : anchor === 'end' ? x - 5 : x}
        y={y + valueFontSize - 2}
        textAnchor={anchor === 'start' ? 'start' : anchor === 'end' ? 'end' : 'middle'}
        style={{
          fontSize: valueFontSize,
          fontFamily: '"IBM Plex Mono", monospace',
          fontWeight: 700,
          letterSpacing: 0.4,
          fill: color,
        }}
      >
        {value}{unit ? <tspan style={{ fontSize, fontWeight: 400 }}> {unit}</tspan> : null}
      </text>
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════════════ */

interface BodyDiagramProps {
  patient: PatientState;
  style?: CSSProperties;
}

export function BodyDiagram({ patient, style }: BodyDiagramProps) {
  const v = patient.visible;
  const h = patient.hidden;
  const vis = useMemo(() => deriveVisuals(patient), [patient]);

  const keyframes = `
    @keyframes heartbeat {
      0%   { transform: scale(${(vis.heartScale * 0.93).toFixed(3)}); }
      12%  { transform: scale(${(vis.heartScale * 1.07).toFixed(3)}); }
      28%  { transform: scale(${(vis.heartScale * 0.97).toFixed(3)}); }
      40%  { transform: scale(${(vis.heartScale * 1.02).toFixed(3)}); }
      100% { transform: scale(${(vis.heartScale * 0.93).toFixed(3)}); }
    }
    @keyframes arteryPulse {
      0%   { opacity: 0.55; }
      18%  { opacity: 1; }
      100% { opacity: 0.55; }
    }
    @keyframes lungBreathe {
      0%   { transform: scaleX(0.97) scaleY(0.98); }
      50%  { transform: scaleX(1.03) scaleY(1.04); }
      100% { transform: scaleX(0.97) scaleY(0.98); }
    }
    @keyframes fluidShimmer {
      0%   { opacity: 0.25; }
      50%  { opacity: 0.65; }
      100% { opacity: 0.25; }
    }
    @keyframes lactateFlash {
      0%   { opacity: 0; }
      50%  { opacity: 0.55; }
      100% { opacity: 0; }
    }
  `;

  // Blood volume ring
  const ringR = 88;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDash = ringCirc * clamp(vis.bvFraction, 0, 1);

  // Lung fill colors
  const lungFill = `hsla(210, 52%, ${lerp(42, 25, vis.evlwFill)}%, ${lerp(0.65, 0.9, vis.evlwFill)})`;
  const lungStroke = severityAlpha(vis.pao2Severity, 0.6);

  // Arterial blood color (SaO2-dependent)
  const arteryRed = `hsl(${lerp(0, 5, vis.sao2Brightness)}, ${lerp(55, 78, vis.sao2Brightness)}%, ${lerp(40, 55, vis.sao2Brightness)}%)`;
  // Venous blood color (desaturated blue)
  const veinBlue = `hsl(${lerp(215, 220, 1 - vis.svo2Severity)}, ${lerp(35, 55, 1 - vis.svo2Severity)}%, ${lerp(32, 48, 1 - vis.svo2Severity)}%)`;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 440,
        aspectRatio: '10 / 14',
        background: 'radial-gradient(ellipse at 50% 35%, rgba(14,24,40,0.97) 0%, rgba(9,16,28,0.99) 100%)',
        border: '1px solid var(--panel-border)',
        borderRadius: 14,
        overflow: 'hidden',
        ...style,
      }}
    >
      <style>{keyframes}</style>

      <svg viewBox="0 0 340 480" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
        <defs>
          {/* Artery gradient */}
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={arteryRed} stopOpacity={0.95} />
            <stop offset="100%" stopColor={arteryRed} stopOpacity={0.5} />
          </linearGradient>
          {/* Vein gradient */}
          <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={veinBlue} stopOpacity={0.9} />
            <stop offset="100%" stopColor={veinBlue} stopOpacity={0.45} />
          </linearGradient>
          {/* Pulmonary artery — deoxygenated */}
          <linearGradient id="pag" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={veinBlue} stopOpacity={0.8} />
            <stop offset="100%" stopColor="#4a7aaa" stopOpacity={0.6} />
          </linearGradient>
          {/* Pulmonary vein — oxygenated returning */}
          <linearGradient id="pvg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={arteryRed} stopOpacity={0.7} />
            <stop offset="100%" stopColor="#c45555" stopOpacity={0.5} />
          </linearGradient>
          {/* EVLW fluid fill */}
          <linearGradient id="evlw" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#3ba8e8" stopOpacity={vis.evlwFill * 0.65} />
            <stop offset={`${clamp(vis.evlwFill * 100, 5, 100)}%`} stopColor="#3ba8e8" stopOpacity={vis.evlwFill * 0.25} />
            <stop offset="100%" stopColor="#3ba8e8" stopOpacity={0} />
          </linearGradient>
          {/* Glow filters */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          </filter>
          <filter id="glowSm" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          <filter id="glowTissue" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
          </filter>
        </defs>

        {/* ─── Title ─── */}
        <text x="170" y="20" textAnchor="middle"
          style={{ fontSize: 10, fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 600, letterSpacing: 1.5, fill: '#4a6d96' }}>
          DIAGRAMA HEMODINÂMICO
        </text>

        {/* ══════════════════════════════════════════════════════════════
           BODY SILHOUETTE
           ══════════════════════════════════════════════════════════════ */}
        {/* Head */}
        <ellipse cx="170" cy="62" rx="28" ry="32" fill="none" stroke="#1a2e4a" strokeWidth="1" opacity={0.4} />
        {/* Torso */}
        <path
          d="M 125 90 Q 108 115 104 165 Q 102 220 108 275 L 122 340 L 140 345 L 148 300
             Q 155 345 170 348 Q 185 345 192 300 L 200 345 L 218 340 L 232 275
             Q 238 220 236 165 Q 232 115 215 90 Z"
          fill="none" stroke="#1a2e4a" strokeWidth="0.8" opacity={0.3}
        />
        {/* Arms */}
        <path d="M 125 92 Q 90 105 72 145 Q 60 180 65 220 Q 68 252 74 270"
          fill="none" stroke="#1a2e4a" strokeWidth="0.7" opacity={0.2} />
        <path d="M 215 92 Q 250 105 268 145 Q 280 180 275 220 Q 272 252 266 270"
          fill="none" stroke="#1a2e4a" strokeWidth="0.7" opacity={0.2} />

        {/* ══════════════════════════════════════════════════════════════
           BLOOD VOLUME RING (circular gauge around torso)
           ══════════════════════════════════════════════════════════════ */}
        <circle cx="170" cy="175" r={ringR} fill="none" stroke="#15253d" strokeWidth="3.5" opacity={0.35} />
        <circle cx="170" cy="175" r={ringR}
          fill="none"
          stroke={severityColor(vis.bvSeverity)}
          strokeWidth="3.5"
          strokeDasharray={`${ringDash} ${ringCirc}`}
          strokeDashoffset={ringCirc * 0.25}
          strokeLinecap="round"
          opacity={0.55}
          style={{ transition: 'stroke-dasharray 1.2s ease, stroke 0.6s ease' }}
        />

        {/* ══════════════════════════════════════════════════════════════
           VENOUS SYSTEM (right side — deoxygenated blood returning)
           Anatomical: SVC/IVC → RA → RV → PA
           ══════════════════════════════════════════════════════════════ */}
        <g>
          {/* Superior vena cava */}
          <path d="M 200 82 Q 198 100 195 118 Q 192 132 190 142"
            fill="none" stroke="url(#vg)" strokeWidth={vis.veinWidth}
            strokeLinecap="round" opacity={clamp(vis.venousFill, 0.45, 1)}
          />
          {/* SVC → RA */}
          <path d="M 190 142 L 188 156"
            fill="none" stroke="url(#vg)" strokeWidth={vis.veinWidth * 0.9}
            strokeLinecap="round" opacity={0.8}
          />
          {/* Inferior vena cava */}
          <path d="M 188 200 Q 190 235 193 270 Q 195 300 198 330"
            fill="none" stroke="url(#vg)" strokeWidth={vis.veinWidth * 0.85}
            strokeLinecap="round" opacity={clamp(vis.venousFill, 0.4, 0.9)}
          />
          {/* IVC → RA */}
          <path d="M 188 185 L 188 200"
            fill="none" stroke="url(#vg)" strokeWidth={vis.veinWidth * 0.8}
            strokeLinecap="round" opacity={0.7}
          />
          {/* Flow dots — venous return */}
          <circle r="1.8" fill={veinBlue} opacity={0.6}>
            <animateMotion dur={`${vis.heartPulseRate * 3}s`} repeatCount="indefinite"
              path="M 200 82 Q 198 100 195 118 Q 192 132 190 142 L 188 156" />
          </circle>
          <circle r="1.5" fill={veinBlue} opacity={0.5}>
            <animateMotion dur={`${vis.heartPulseRate * 4}s`} repeatCount="indefinite"
              path="M 198 330 Q 195 300 193 270 Q 190 235 188 200 L 188 185" />
          </circle>
        </g>

        {/* ══════════════════════════════════════════════════════════════
           ARTERIAL SYSTEM (left side — oxygenated blood)
           Anatomical: LV → Aorta → systemic arteries
           ══════════════════════════════════════════════════════════════ */}
        <g>
          {/* Ascending aorta + arch */}
          <path d="M 155 168 Q 152 150 148 130 Q 144 112 140 95"
            fill="none" stroke="url(#ag)" strokeWidth={vis.arteryWidth}
            strokeLinecap="round"
            style={{ animation: `arteryPulse ${vis.heartPulseRate}s ease-in-out infinite` }}
          />
          {/* Descending aorta */}
          <path d="M 155 195 Q 152 230 148 268 Q 145 300 142 330"
            fill="none" stroke="url(#ag)" strokeWidth={vis.arteryWidth * 0.82}
            strokeLinecap="round"
            style={{ animation: `arteryPulse ${vis.heartPulseRate}s ease-in-out infinite`, animationDelay: '0.06s' }}
          />
          {/* Root aorta */}
          <path d="M 155 168 L 155 195"
            fill="none" stroke="url(#ag)" strokeWidth={vis.arteryWidth * 0.88}
            strokeLinecap="round"
            style={{ animation: `arteryPulse ${vis.heartPulseRate}s ease-in-out infinite`, animationDelay: '0.03s' }}
          />
          {/* Flow dots — arterial */}
          <circle r="2" fill={arteryRed} opacity={0.7}>
            <animateMotion dur={`${vis.heartPulseRate * 1.5}s`} repeatCount="indefinite"
              path="M 155 168 Q 152 150 148 130 Q 144 112 140 95" />
          </circle>
          <circle r="1.8" fill={arteryRed} opacity={0.6}>
            <animateMotion dur={`${vis.heartPulseRate * 2.5}s`} repeatCount="indefinite"
              path="M 155 195 Q 152 230 148 268 Q 145 300 142 330" />
          </circle>
        </g>

        {/* ══════════════════════════════════════════════════════════════
           PULMONARY CIRCULATION
           RV → PA → lungs (gas exchange) → PV → LA
           ══════════════════════════════════════════════════════════════ */}
        <g>
          {/* Pulmonary arteries (RV → lungs) — deoxygenated */}
          <path d="M 175 155 Q 165 135 145 127 Q 130 122 118 125"
            fill="none" stroke="url(#pag)" strokeWidth={vis.pulmonaryWidth}
            strokeLinecap="round" opacity={0.75}
          />
          <path d="M 175 155 Q 185 135 200 127 Q 215 122 225 125"
            fill="none" stroke="url(#pag)" strokeWidth={vis.pulmonaryWidth}
            strokeLinecap="round" opacity={0.75}
          />
          {/* Pulmonary veins (lungs → LA) — oxygenated */}
          <path d="M 122 175 Q 135 180 150 178 Q 158 176 162 172"
            fill="none" stroke="url(#pvg)" strokeWidth={2.2}
            strokeLinecap="round" opacity={0.6}
          />
          <path d="M 222 175 Q 208 180 195 178 Q 185 176 180 172"
            fill="none" stroke="url(#pvg)" strokeWidth={2.2}
            strokeLinecap="round" opacity={0.6}
          />
          {/* Flow dot — PA */}
          <circle r="1.5" fill={veinBlue} opacity={0.6}>
            <animateMotion dur={`${vis.heartPulseRate * 2}s`} repeatCount="indefinite"
              path="M 175 155 Q 165 135 145 127 Q 130 122 118 125" />
          </circle>
          {/* Flow dot — PV return */}
          <circle r="1.5" fill={arteryRed} opacity={0.5}>
            <animateMotion dur={`${vis.heartPulseRate * 2.2}s`} repeatCount="indefinite"
              path="M 122 175 Q 135 180 150 178 Q 158 176 162 172" />
          </circle>
        </g>

        {/* ══════════════════════════════════════════════════════════════
           LUNGS (with EVLW overlay + breathing animation)
           ══════════════════════════════════════════════════════════════ */}
        {/* Right lung */}
        <g style={{ transformOrigin: '120px 155px', animation: 'lungBreathe 4.2s ease-in-out infinite' }}>
          <path
            d="M 100 112 Q 90 132 88 158 Q 88 185 98 198 Q 115 212 132 195 
               Q 142 178 142 155 Q 142 130 132 118 Q 122 108 100 112 Z"
            fill={lungFill} stroke={lungStroke} strokeWidth="1.2"
          />
          {/* Bronchi pattern */}
          <path d="M 115 120 L 115 165 M 115 135 L 105 145 M 115 150 L 125 160"
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
          {/* EVLW fluid overlay */}
          {vis.evlwFill > 0.08 && (
            <path
              d="M 100 112 Q 90 132 88 158 Q 88 185 98 198 Q 115 212 132 195 
                 Q 142 178 142 155 Q 142 130 132 118 Q 122 108 100 112 Z"
              fill="url(#evlw)" opacity={1}
              style={{ animation: vis.evlwFill > 0.25 ? 'fluidShimmer 2.8s ease-in-out infinite' : 'none' }}
            />
          )}
        </g>

        {/* Left lung */}
        <g style={{ transformOrigin: '222px 155px', animation: 'lungBreathe 4.2s ease-in-out infinite', animationDelay: '0.35s' }}>
          <path
            d="M 242 112 Q 252 132 254 158 Q 254 185 244 198 Q 227 212 210 195 
               Q 200 178 200 155 Q 200 130 210 118 Q 220 108 242 112 Z"
            fill={lungFill} stroke={lungStroke} strokeWidth="1.2"
          />
          <path d="M 227 120 L 227 165 M 227 135 L 237 145 M 227 150 L 217 160"
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
          {vis.evlwFill > 0.08 && (
            <path
              d="M 242 112 Q 252 132 254 158 Q 254 185 244 198 Q 227 212 210 195 
                 Q 200 178 200 155 Q 200 130 210 118 Q 220 108 242 112 Z"
              fill="url(#evlw)" opacity={1}
              style={{ animation: vis.evlwFill > 0.25 ? 'fluidShimmer 2.8s ease-in-out infinite' : 'none', animationDelay: '0.4s' }}
            />
          )}
        </g>

        {/* ══════════════════════════════════════════════════════════════
           HEART — 4 CHAMBERS (RA, RV, LA, LV)
           Anatomical right = viewer's right: RA/RV
           Anatomical left = viewer's left: LA/LV
           ══════════════════════════════════════════════════════════════ */}
        <g style={{ transformOrigin: '170px 172px', animation: `heartbeat ${vis.heartPulseRate}s ease-in-out infinite` }}>
          {/* Heart glow */}
          <ellipse cx="170" cy="172" rx="24" ry="24"
            fill={vis.lvColor} opacity={0.12} filter="url(#glow)" />

          {/* Pericardium */}
          <path
            d="M 170 195  
               Q 152 190 148 175 Q 145 163 150 155 Q 156 148 170 153
               Q 184 148 190 155 Q 195 163 192 175 Q 188 190 170 195 Z"
            fill="rgba(20,32,52,0.7)" stroke="rgba(100,140,185,0.25)" strokeWidth="0.8"
          />

          {/* RA — right atrium (top-right of heart shape) */}
          <ellipse
            cx={178 + vis.rvDilation * 3} cy="160"
            rx={lerp(7, 10, vis.rvDilation)} ry={lerp(7, 9, vis.rvDilation)}
            fill={vis.rvColor} opacity={0.35}
            stroke="rgba(255,255,255,0.12)" strokeWidth="0.5"
          />

          {/* RV — right ventricle (bottom-right) */}
          <ellipse
            cx={180 + vis.rvDilation * 4} cy="174"
            rx={lerp(8, 13, vis.rvDilation)} ry={lerp(9, 13, vis.rvDilation)}
            fill={vis.rvColor} opacity={0.4}
            stroke={vis.rvStrain > 0.4 ? severityAlpha(vis.rvStrain, 0.5) : 'rgba(255,255,255,0.1)'}
            strokeWidth={vis.rvStrain > 0.4 ? 1.2 : 0.5}
            strokeDasharray={vis.rvStrain > 0.5 ? '3 2' : 'none'}
          />

          {/* LA — left atrium (top-left) */}
          <ellipse
            cx="162" cy="160"
            rx="7" ry="7"
            fill={vis.lvColor} opacity={0.35}
            stroke="rgba(255,255,255,0.12)" strokeWidth="0.5"
          />

          {/* LV — left ventricle (bottom-left, main pump) */}
          <ellipse
            cx="160" cy="175"
            rx={lerp(7, 10, vis.lvEjection)}
            ry={lerp(9, 13, vis.lvEjection)}
            fill={vis.lvColor} opacity={0.5}
            stroke="rgba(255,255,255,0.15)" strokeWidth="0.6"
          />

          {/* Septum */}
          <line x1="170" y1="153" x2="170" y2="192"
            stroke="rgba(180,210,240,0.15)" strokeWidth="0.8" />

          {/* AV valve plane */}
          <line x1="150" y1="166" x2="192" y2="166"
            stroke="rgba(180,210,240,0.1)" strokeWidth="0.5" />

          {/* Chamber labels */}
          <text x="162" y="162" textAnchor="middle"
            style={{ fontSize: 5, fill: 'rgba(200,220,240,0.4)', fontFamily: '"IBM Plex Mono", monospace' }}>LA</text>
          <text x={178 + vis.rvDilation * 3} y="162" textAnchor="middle"
            style={{ fontSize: 5, fill: 'rgba(200,220,240,0.4)', fontFamily: '"IBM Plex Mono", monospace' }}>RA</text>
          <text x="160" y="178" textAnchor="middle"
            style={{ fontSize: 5, fill: 'rgba(200,220,240,0.5)', fontFamily: '"IBM Plex Mono", monospace' }}>VE</text>
          <text x={180 + vis.rvDilation * 4} y="177" textAnchor="middle"
            style={{ fontSize: 5, fill: 'rgba(200,220,240,0.4)', fontFamily: '"IBM Plex Mono", monospace' }}>VD</text>
        </g>

        {/* ══════════════════════════════════════════════════════════════
           TISSUE PERFUSION — peripheral glow
           ══════════════════════════════════════════════════════════════ */}
        <g>
          <ellipse cx="72" cy="215" rx="16" ry="24"
            fill={severityColor(vis.do2Severity)} opacity={0.08} filter="url(#glowTissue)" />
          <ellipse cx="268" cy="215" rx="16" ry="24"
            fill={severityColor(vis.do2Severity)} opacity={0.08} filter="url(#glowTissue)" />
          <ellipse cx="170" cy="340" rx="35" ry="22"
            fill={severityColor(vis.do2Severity)} opacity={0.06} filter="url(#glowTissue)" />

          {/* Lactate flash in peripheral tissues */}
          {vis.lactateFlash && (
            <g style={{ animation: 'lactateFlash 1.8s ease-in-out infinite' }}>
              <circle cx="72" cy="215" r="20" fill="#f7766d" opacity={0.12} />
              <circle cx="268" cy="215" r="20" fill="#f7766d" opacity={0.12} />
              <circle cx="170" cy="340" r="28" fill="#f7766d" opacity={0.08} />
            </g>
          )}
        </g>

        {/* ══════════════════════════════════════════════════════════════
           METRIC LABELS — anatomically placed

           Placement rationale:
           ● DC, FC       → below heart (cardiac pump output)
           ● PAM          → along descending aorta / arterial side
           ● RVS          → arterial side, below PAM (vascular tone)
           ● SVV          → near LV outflow (stroke volume variation)
           ● PVPI         → near lung (permeability index)
           ● PVC (CVP)    → at SVC/RA junction (central venous pressure)
           ● SvO₂         → in venous return pathway (mixed venous sat)
           ● GEDI         → near heart/right side (global preload)
           ● EVLW         → inside right lung (extravascular lung water)
           ● PaO₂         → near left lung (arterial oxygenation)
           ● Lac          → peripheral tissues (anaerobic metabolism)
           ● DO₂          → below lactate (systemic delivery)
           ● Vol          → top of volume ring
           ● pH           → top-left (systemic acid-base)
           ══════════════════════════════════════════════════════════════ */}

        {/* ── HEART REGION ── */}
        <MetricBadge x={170} y={214} label="DC" value={v.cardiacOutput.toFixed(1)} unit="L/min"
          severity={vis.coSeverity} />
        <MetricBadge x={170} y={238} label="FC" value={`${Math.round(v.hr)}`} unit="bpm"
          severity={v.hr > 120 ? 0.7 : v.hr < 50 ? 0.8 : 0} size="sm" />

        {/* ── ARTERIAL SIDE ── */}
        <MetricBadge x={110} y={265} label="PAM" value={`${Math.round(v.map)}`} unit="mmHg"
          severity={vis.mapSeverity} anchor="end" />
        <MetricBadge x={110} y={291} label="RVS" value={`${Math.round(v.svr)}`}
          severity={v.svr > 1800 ? 0.7 : v.svr < 600 ? 0.8 : 0.1} anchor="end" size="sm" />
        <MetricBadge x={110} y={185} label="SVV" value={`${Math.round(v.svv)}`} unit="%"
          severity={v.svv > 15 ? 0.6 : 0} anchor="end" size="sm" />

        {/* ── VENOUS SIDE ── */}
        {/* PVC at SVC/RA junction — anatomically correct for central venous pressure */}
        <MetricBadge x={230} y={120} label="PVC" value={`${v.cvp.toFixed(0)}`} unit="mmHg"
          severity={vis.cvpSeverity} anchor="start" size="sm" />
        {/* SvO₂ on venous return (mixed venous saturation) */}
        <MetricBadge x={230} y={262} label="SvO₂" value={`${Math.round(v.svo2)}`} unit="%"
          severity={vis.svo2Severity} anchor="start" />
        {/* GEDI near heart — global end-diastolic volume index (preload) */}
        <MetricBadge x={230} y={186} label="GEDI" value={`${Math.round(v.gedi)}`}
          severity={v.gedi < 500 ? 0.8 : v.gedi > 900 ? 0.5 : 0} anchor="start" size="sm" />

        {/* ── LUNGS ── */}
        {/* EVLW inside right lung — extravascular lung water */}
        <MetricBadge x={112} y={155} label="EVLW" value={v.evlw.toFixed(0)}
          severity={clamp((v.evlw - 10) / 15, 0, 1)} size="sm" />
        {/* PaO₂ near left lung — arterial O₂ tension from gas exchange */}
        <MetricBadge x={263} y={155} label="PaO₂" value={`${Math.round(v.pao2)}`}
          severity={vis.pao2Severity} anchor="start" size="sm" />
        {/* PVPI near right lung — permeability index */}
        <MetricBadge x={112} y={200} label="PVPI" value={v.pvpi.toFixed(1)}
          severity={v.pvpi > 3 ? 0.8 : v.pvpi > 2 ? 0.4 : 0} anchor="end" size="sm" />

        {/* ── TISSUE / DISTAL ── */}
        <MetricBadge x={170} y={358} label="Lac" value={v.lactate.toFixed(1)} unit="mmol/L"
          severity={vis.lactateSeverity} />
        <MetricBadge x={170} y={382} label="DO₂" value={`${Math.round(v.do2)}`}
          severity={vis.do2Severity} size="sm" />

        {/* ── VOLUME STATUS (top ring) ── */}
        <MetricBadge x={170} y={72} label="Vol" value={`${Math.round(h.bloodVolume)}`} unit="mL"
          severity={vis.bvSeverity} size="sm" />

        {/* ── SYSTEMIC (top corners) ── */}
        <MetricBadge x={112} y={68} label="pH" value={v.ph.toFixed(2)}
          severity={v.ph < 7.25 ? 1 : v.ph < 7.32 ? 0.6 : v.ph > 7.5 ? 0.5 : 0} anchor="end" size="sm" />

        {/* ══════════════════════════════════════════════════════════════
           FLOW DIRECTION ARROWS
           ══════════════════════════════════════════════════════════════ */}
        {/* Arterial (ascending) */}
        <path d="M 148 108 L 144 100 L 152 100 Z" fill={arteryRed} opacity={0.5} />
        {/* Venous return (descending into RA) */}
        <path d="M 193 118 L 189 126 L 197 126 Z" fill={veinBlue} opacity={0.5} />
        {/* PA flow to lungs */}
        <path d="M 130 123 L 126 128 L 132 131 Z" fill={veinBlue} opacity={0.4} />
        <path d="M 215 123 L 220 128 L 214 131 Z" fill={veinBlue} opacity={0.4} />

        {/* ══════════════════════════════════════════════════════════════
           LEGEND
           ══════════════════════════════════════════════════════════════ */}
        <g transform="translate(15, 462)">
          <circle cx="5" cy="0" r="3" fill={severityColor(0)} opacity={0.7} />
          <text x="12" y="3.5" style={{ fontSize: 7, fill: '#4a6d96', fontFamily: '"IBM Plex Sans", sans-serif' }}>Normal</text>
          <circle cx="58" cy="0" r="3" fill={severityColor(0.5)} opacity={0.7} />
          <text x="65" y="3.5" style={{ fontSize: 7, fill: '#4a6d96', fontFamily: '"IBM Plex Sans", sans-serif' }}>Alerta</text>
          <circle cx="108" cy="0" r="3" fill={severityColor(1)} opacity={0.7} />
          <text x="115" y="3.5" style={{ fontSize: 7, fill: '#4a6d96', fontFamily: '"IBM Plex Sans", sans-serif' }}>Crítico</text>
          <line x1="155" y1="-3" x2="155" y2="3" stroke="#1e3352" strokeWidth="0.5" />
          <circle cx="165" cy="0" r="2" fill={arteryRed} opacity={0.7} />
          <text x="172" y="3.5" style={{ fontSize: 7, fill: '#4a6d96', fontFamily: '"IBM Plex Sans", sans-serif' }}>Arterial</text>
          <circle cx="210" cy="0" r="2" fill={veinBlue} opacity={0.7} />
          <text x="217" y="3.5" style={{ fontSize: 7, fill: '#4a6d96', fontFamily: '"IBM Plex Sans", sans-serif' }}>Venoso</text>
        </g>
      </svg>
    </div>
  );
}
