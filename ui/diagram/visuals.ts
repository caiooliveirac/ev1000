/**
 * Derives all visual properties from the engine's PatientState.
 * Single source of truth for how physiology maps to visuals.
 */

import { PatientState } from '@/engine/types';
import { clamp, lerp, remap, severityColor } from './colors';

/* ── Exported interface — consumed by every diagram sub-component ── */

export interface BodyVisuals {
  // Heart
  heartPulseRate: number;  // seconds per beat
  heartScale: number;
  coSeverity: number;      // 0 = normal CO, 1 = critically low
  lvEjection: number;      // 0–1 contractility
  rvStrain: number;        // 0–1
  rvDilation: number;      // 0–0.8
  lvColor: string;
  rvColor: string;

  // Lungs
  evlwFill: number;        // 0–1 fluid fraction
  pao2Severity: number;

  // Arteries
  arteryWidth: number;     // stroke-width (SVR-dependent)
  mapSeverity: number;

  // Veins
  veinWidth: number;       // stroke-width (CVP + BV dependent)
  cvpSeverity: number;
  venousFill: number;      // 0.3–1.2 opacity factor

  // Pulmonary
  pulmonaryWidth: number;
  pvrSeverity: number;

  // Blood volume
  bvFraction: number;      // 0–1.3
  bvSeverity: number;
  heartVolumeFactor: number; // 0.7–1.25 — chamber size multiplier

  // Tissue
  do2Severity: number;
  lactateSeverity: number;
  lactateFlash: boolean;

  // Oxygenation
  svo2Severity: number;
  sao2Brightness: number;
}

export function deriveVisuals(p: PatientState): BodyVisuals {
  const v = p.visible;
  const h = p.hidden;
  const hrSafe = Math.max(v.hr, 35);

  // ── Heart ──
  const coNorm = clamp(v.cardiacOutput / 5.5, 0.2, 1.5);
  const coSeverity = clamp(1 - coNorm, 0, 1);
  const heartScale = remap(coNorm, 0.2, 1.0, 0.85, 1.12);
  const lvEjection = clamp(h.contractilityLV, 0, 1);
  const rvStrain = clamp(
    (h.pulmonaryResistance - (h.basalPVR || 220)) / 800 +
      Math.max(0, h.rightAtrialPressure - 12) / 12,
    0, 1,
  );
  const rvDilation = clamp(rvStrain * 0.8, 0, 0.8);

  // ── Lungs ──
  const pao2Severity = clamp(1 - (v.pao2 - 50) / 50, 0, 1);
  const evlwFill = clamp((v.evlw - 7) / 22, 0, 1);

  // ── Arteries ── (vasoconstriction → narrower caliber, vasodilation → wider)
  const svrNorm = clamp(v.svr / 1200, 0.3, 2.2);
  const arteryWidth = remap(svrNorm, 0.3, 2.2, 7.0, 2.5);
  const mapSeverity =
    v.map < 55 ? 1 :
    v.map < 65 ? remap(v.map, 55, 65, 1, 0.5) :
    v.map <= 100 ? remap(v.map, 65, 100, 0.5, 0) :
    clamp((v.map - 100) / 50, 0, 0.6);

  // ── Veins ──
  const cvpSeverity =
    v.cvp > 18 ? 1 :
    v.cvp > 12 ? remap(v.cvp, 12, 18, 0.4, 1) :
    v.cvp < 4  ? remap(v.cvp, 0, 4, 0.8, 0.4) :
    remap(v.cvp, 4, 12, 0.4, 0);
  const veinWidthCvp = remap(clamp(v.cvp / 18, 0.15, 1.5), 0.15, 1.5, 2.5, 7.5);
  const bvWidthFactor = clamp(h.bloodVolume / 5000, 0.5, 1.3);   // hypovolemia shrinks, congestion expands
  const veinWidth = veinWidthCvp * bvWidthFactor;
  const venousFill = clamp(h.bloodVolume / 5500, 0.3, 1.2);

  // ── Pulmonary ──
  const pvrNorm = clamp(h.pulmonaryResistance / 500, 0.3, 3);
  const pulmonaryWidth = remap(pvrNorm, 0.3, 3, 2, 5);
  const pvrSeverity = clamp((h.pulmonaryResistance - 250) / 700, 0, 1);

  // ── Blood volume ──
  const bvFraction = clamp(h.bloodVolume / 5000, 0.25, 1.3);
  const heartVolumeFactor = clamp(h.bloodVolume / 5000, 0.7, 1.25);  // heart chambers shrink in hypovolemia, expand in congestion
  const bvSeverity =
    h.bloodVolume < 3500 ? 1 :
    h.bloodVolume < 4200 ? remap(h.bloodVolume, 3500, 4200, 1, 0.4) : 0;

  // ── Tissue ──
  const do2Severity = v.do2 < 350 ? 1 : v.do2 < 550 ? remap(v.do2, 350, 550, 1, 0.4) : 0;
  const lactateSeverity =
    v.lactate > 8 ? 1 :
    v.lactate > 4 ? remap(v.lactate, 4, 8, 0.6, 1) :
    v.lactate > 2 ? remap(v.lactate, 2, 4, 0, 0.6) : 0;
  const lactateFlash = v.lactate > 4;

  // ── Oxygenation ──
  const svo2Severity = v.svo2 < 50 ? 1 : v.svo2 < 65 ? remap(v.svo2, 50, 65, 1, 0.4) : 0;
  const sao2Brightness = clamp((v.sao2 - 85) / 13, 0, 1);

  return {
    heartPulseRate: 60 / hrSafe,
    heartScale, coSeverity, lvEjection, rvStrain, rvDilation,
    lvColor: severityColor(coSeverity),
    rvColor: rvStrain > 0.3 ? severityColor(rvStrain) : severityColor(coSeverity),
    evlwFill, pao2Severity,
    arteryWidth, mapSeverity,
    veinWidth, cvpSeverity, venousFill,
    pulmonaryWidth, pvrSeverity,
    bvFraction, bvSeverity, heartVolumeFactor,
    do2Severity, lactateSeverity, lactateFlash,
    svo2Severity, sao2Brightness,
  };
}
