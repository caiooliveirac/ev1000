/**
 * BodyDiagram — orchestrator for the hemodynamic visualization.
 *
 * Architecture (for easy AI iteration):
 *   diagram/colors.ts       — pure color utilities (~60 lines)
 *   diagram/visuals.ts      — deriveVisuals + BodyVisuals type (~120 lines)
 *   diagram/MetricBadge.tsx  — reusable metric label (~50 lines)
 *   diagram/Silhouette.tsx   — body outline (~25 lines)
 *   diagram/VolumeRing.tsx   — blood volume gauge (~30 lines)
 *   diagram/Heart.tsx        — 4-chamber heart + HeartDefs (~110 lines)
 *   diagram/Lungs.tsx        — lungs + LungDefs (~65 lines)
 *   diagram/Vessels.tsx      — 3D arteries/veins + VesselDefs (~140 lines)
 *   diagram/Tissue.tsx       — perfusion glow (~30 lines)
 *   diagram/Metrics.tsx      — positioned metric badges (~80 lines)
 *   diagram/Legend.tsx        — bottom legend (~25 lines)
 *
 * To iterate on a specific organ, edit ONLY that file.
 * This orchestrator is ~80 lines and rarely changes.
 */
'use client';

import { CSSProperties, useMemo } from 'react';
import { PatientState } from '@/engine/types';
import { arteryHue, veinHue } from './diagram/colors';
import { deriveVisuals } from './diagram/visuals';
import { Silhouette } from './diagram/Silhouette';
import { VolumeRing } from './diagram/VolumeRing';
import { Heart, HeartDefs } from './diagram/Heart';
import { Lungs, LungDefs } from './diagram/Lungs';
import { Vessels, VesselDefs } from './diagram/Vessels';
import { Tissue } from './diagram/Tissue';
import { Metrics } from './diagram/Metrics';
import { Legend } from './diagram/Legend';

interface Props {
  patient: PatientState;
  style?: CSSProperties;
}

export function BodyDiagram({ patient, style }: Props) {
  const vis = useMemo(() => deriveVisuals(patient), [patient]);
  const arteryColor = arteryHue(vis.sao2Brightness);
  const veinColor = veinHue(vis.svo2Severity);

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

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: 440,
      aspectRatio: '10 / 14',
      background: 'radial-gradient(ellipse at 50% 35%, rgba(14,24,40,0.95) 0%, rgba(8,14,26,0.98) 100%)',
      border: '1px solid var(--panel-border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.3), 0 0 60px rgba(70,194,255,0.03)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      ...style,
    }}>
      <style>{keyframes}</style>
      <svg viewBox="0 0 340 480" preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}>
        <defs>
          <HeartDefs />
          <LungDefs evlwFill={vis.evlwFill} />
          <VesselDefs arteryColor={arteryColor} veinColor={veinColor} />
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          </filter>
          <filter id="glowTissue" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
          </filter>
        </defs>

        {/* Title */}
        <text x={170} y={20} textAnchor="middle"
          style={{ fontSize: 10, fontFamily: '"IBM Plex Sans", sans-serif',
            fontWeight: 600, letterSpacing: 1.5, fill: '#4a6d96' }}>
          DIAGRAMA HEMODINÂMICO
        </text>

        {/* Layers — back to front */}
        <Silhouette />
        <VolumeRing vis={vis} />
        <Vessels vis={vis} arteryColor={arteryColor} veinColor={veinColor} />
        <Lungs vis={vis} />
        <Heart vis={vis} />
        <Tissue vis={vis} />
        <Metrics vis={vis} v={patient.visible} bloodVolume={patient.hidden.bloodVolume} />
        <Legend arteryColor={arteryColor} veinColor={veinColor} />
      </svg>
    </div>
  );
}
