/**
 * Metrics — all metric badges placed at anatomically correct positions.
 *
 * Placement rationale (documented for easy AI iteration):
 * ┌─────────┬───────────────────────────────────────────────────────┐
 * │ Metric  │ Location & reasoning                                 │
 * ├─────────┼───────────────────────────────────────────────────────┤
 * │ DC, FC  │ Below heart — cardiac pump output                    │
 * │ PAM     │ Descending aorta / arterial side                     │
 * │ RVS     │ Below PAM — vascular tone (SVR)                      │
 * │ SVV     │ Near LV outflow — stroke volume variation             │
 * │ PVC     │ SVC/RA junction — central venous pressure             │
 * │ SvO₂   │ Venous return — mixed venous saturation               │
 * │ GEDI    │ Near heart right side — global preload                │
 * │ EVLW    │ Inside right lung — extravascular lung water          │
 * │ PaO₂   │ Near left lung — gas exchange result                  │
 * │ PVPI    │ Near right lung — permeability index                  │
 * │ Lac     │ Peripheral tissues — anaerobic metabolism             │
 * │ DO₂    │ Below lactate — oxygen delivery to tissues            │
 * │ Vol     │ Top of volume ring — total blood volume               │
 * │ pH      │ Top-left — systemic acid-base                        │
 * └─────────┴───────────────────────────────────────────────────────┘
 */

import { clamp } from './colors';
import { MetricBadge } from './MetricBadge';
import type { BodyVisuals } from './visuals';

interface Props {
  vis: BodyVisuals;
  /** patient.visible */
  v: {
    cardiacOutput: number; hr: number; map: number; svr: number;
    svv: number; cvp: number; svo2: number; gedi: number;
    evlw: number; pao2: number; pvpi: number; lactate: number;
    do2: number; ph: number;
  };
  /** patient.hidden.bloodVolume */
  bloodVolume: number;
}

export function Metrics({ vis, v, bloodVolume }: Props) {
  return (
    <>
      {/* ── HEART ── */}
      <MetricBadge x={170} y={214} label="DC" value={v.cardiacOutput.toFixed(1)} unit="L/min"
        severity={vis.coSeverity} />
      <MetricBadge x={170} y={238} label="FC" value={`${Math.round(v.hr)}`} unit="bpm"
        severity={v.hr > 120 ? 0.7 : v.hr < 50 ? 0.8 : 0} size="sm" />

      {/* ── ARTERIAL (viewer's right — near aorta / LV) ── */}
      <MetricBadge x={230} y={265} label="PAM" value={`${Math.round(v.map)}`} unit="mmHg"
        severity={vis.mapSeverity} anchor="start" />
      <MetricBadge x={230} y={291} label="RVS" value={`${Math.round(v.svr)}`}
        severity={v.svr > 1800 ? 0.7 : v.svr < 600 ? 0.8 : 0.1} anchor="start" size="sm" />
      <MetricBadge x={230} y={185} label="SVV" value={`${Math.round(v.svv)}`} unit="%"
        severity={v.svv > 15 ? 0.6 : 0} anchor="start" size="sm" />

      {/* ── VENOUS (viewer's left — near SVC/IVC / RA) ── */}
      <MetricBadge x={110} y={120} label="PVC" value={`${v.cvp.toFixed(0)}`} unit="mmHg"
        severity={vis.cvpSeverity} anchor="end" size="sm" />
      <MetricBadge x={110} y={262} label="SvO₂" value={`${Math.round(v.svo2)}`} unit="%"
        severity={vis.svo2Severity} anchor="end" />
      <MetricBadge x={110} y={186} label="GEDI" value={`${Math.round(v.gedi)}`}
        severity={v.gedi < 500 ? 0.8 : v.gedi > 900 ? 0.5 : 0} anchor="end" size="sm" />

      {/* ── LUNGS ── */}
      <MetricBadge x={112} y={155} label="EVLW" value={v.evlw.toFixed(0)}
        severity={clamp((v.evlw - 10) / 15, 0, 1)} size="sm" />
      <MetricBadge x={263} y={155} label="PaO₂" value={`${Math.round(v.pao2)}`}
        severity={vis.pao2Severity} anchor="start" size="sm" />
      <MetricBadge x={112} y={200} label="PVPI" value={v.pvpi.toFixed(1)}
        severity={v.pvpi > 3 ? 0.8 : v.pvpi > 2 ? 0.4 : 0} anchor="end" size="sm" />

      {/* ── TISSUE ── */}
      <MetricBadge x={170} y={358} label="Lac" value={v.lactate.toFixed(1)} unit="mmol/L"
        severity={vis.lactateSeverity} />
      <MetricBadge x={170} y={382} label="DO₂" value={`${Math.round(v.do2)}`}
        severity={vis.do2Severity} size="sm" />

      {/* ── TOP ── */}
      <MetricBadge x={170} y={72} label="Vol" value={`${Math.round(bloodVolume)}`} unit="mL"
        severity={vis.bvSeverity} size="sm" />
      <MetricBadge x={112} y={68} label="pH" value={v.ph.toFixed(2)}
        severity={v.ph < 7.25 ? 1 : v.ph < 7.32 ? 0.6 : v.ph > 7.5 ? 0.5 : 0} anchor="end" size="sm" />
    </>
  );
}
