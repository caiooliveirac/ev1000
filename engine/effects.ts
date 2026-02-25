import { clamp } from '@/engine/math';
import { EffectCurve, Intervention } from '@/engine/types';

const effectId = (() => {
  let value = 0;
  return () => {
    value += 1;
    return `effect_${value}`;
  };
})();

export const createEffectFromIntervention = (
  nowSec: number,
  intervention: Intervention
): EffectCurve | null => {
  switch (intervention.type) {
    case 'give_fluid_bolus': {
      const volumeMl = clamp(intervention.volumeMl ?? 250, 50, 1500);
      // Faster bolus kinetics so preload effects are visible within 5 min.
      const riseSec = Math.round(20 + volumeMl * 0.08);
      const peakSec = Math.round(40 + volumeMl * 0.04);
      const decaySec = Math.round(120 + volumeMl * 0.15);
      return {
        id: effectId(),
        interventionType: intervention.type,
        startAtSec: nowSec,
        latencySec: 4,
        riseSec,
        peakSec,
        decaySec,
        durationSec: Math.round(6 + riseSec + peakSec + decaySec),
        channels: {
          bloodVolume: volumeMl
        }
      };
    }
    case 'give_transfusion': {
      const units = clamp(intervention.units ?? 1, 1, 2);
      const bloodVolume = units * 300;
      const hbRise = units * 1.1;
      const riseSec = Math.round(540 + units * 120);
      const peakSec = Math.round(360 + units * 120);
      const decaySec = Math.round(5000 + units * 700);
      return {
        id: effectId(),
        interventionType: intervention.type,
        startAtSec: nowSec,
        latencySec: 45,
        riseSec,
        peakSec,
        decaySec,
        durationSec: 45 + riseSec + peakSec + decaySec,
        channels: {
          bloodVolume,
          hb: hbRise
        }
      };
    }
    default:
      return null;
  }
};

export const evaluateEffectIntensity = (effect: EffectCurve, nowSec: number): number => {
  const elapsed = nowSec - effect.startAtSec;
  if (elapsed <= 0 || elapsed >= effect.durationSec) {
    return 0;
  }

  const latencyEnd = effect.latencySec;
  const riseEnd = latencyEnd + effect.riseSec;
  const peakEnd = riseEnd + effect.peakSec;
  const decayEnd = peakEnd + effect.decaySec;

  if (elapsed < latencyEnd) {
    return 0;
  }

  if (elapsed < riseEnd) {
    return clamp((elapsed - latencyEnd) / Math.max(effect.riseSec, 1), 0, 1);
  }

  if (elapsed < peakEnd) {
    return 1;
  }

  if (elapsed < decayEnd) {
    const remaining = 1 - (elapsed - peakEnd) / Math.max(effect.decaySec, 1);
    return clamp(remaining, 0, 1);
  }

  return 0;
};
