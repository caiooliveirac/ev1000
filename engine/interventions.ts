/**
 * Intervention handling — translates user actions (set norad, give bolus,
 * change ventilator settings, etc.) into scheduled effects and hidden
 * state mutations.
 */
import { createEffectFromIntervention } from '@/engine/effects';
import { clamp, nextMulberry32 } from '@/engine/math';
import { Intervention, PatientState } from '@/engine/types';
import { pushEvent } from '@/engine/defaults';

const pickOnset = (
  rngState: number,
  minSec: number,
  maxSec: number
): { onset: number; rngState: number } => {
  const random = nextMulberry32(rngState);
  const onset = Math.round(minSec + random.value * (maxSec - minSec));
  return { onset, rngState: random.state };
};

export const applyIntervention = (
  patientState: PatientState,
  intervention: Intervention
): PatientState => {
  const next: PatientState = {
    ...patientState,
    hidden: { ...patientState.hidden },
    scheduledEffects: [...patientState.scheduledEffects],
    engineEvents: []
  };

  const hidden = next.hidden;

  const sensitivityTag =
    hidden.catecholamineSensitivity < 0.75
      ? 'baixa'
      : hidden.catecholamineSensitivity > 1.15
      ? 'alta'
      : 'intermediaria';

  switch (intervention.type) {
    case 'set_norepinephrine_rate': {
      const rate = clamp(intervention.value ?? 0, 0, 3);
      const picked = pickOnset(next.rngState, 30, 90);
      next.rngState = picked.rngState;
      hidden.pendingNorepinephrineRate = rate;
      hidden.norepinephrineApplyAtSec = next.timeSec + picked.onset;
      const effective = rate * hidden.catecholamineSensitivity;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Norad ajustada para ${rate.toFixed(3)} mcg/kg/min. Efeito esperado em ${picked.onset}s. Dose efetiva estimada ${effective.toFixed(3)} (sensibilidade ${sensitivityTag}).`
      );
      if (rate > 1.5) {
        pushEvent(
          next.engineEvents,
          next.timeSec,
          'adverse',
          'Aviso: dose extrema de norad, com ganho marginal menor e maior risco de eventos adversos.'
        );
      }
      break;
    }
    case 'set_dobutamine_rate': {
      const rate = clamp(intervention.value ?? 0, 0, 20);
      const picked = pickOnset(next.rngState, 20, 60);
      next.rngState = picked.rngState;
      hidden.pendingDobutamineRate = rate;
      hidden.dobutamineApplyAtSec = next.timeSec + picked.onset;
      const effective = rate * hidden.catecholamineSensitivity;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Dobutamina ajustada para ${rate.toFixed(1)} mcg/kg/min. Efeito esperado em ${picked.onset}s. Dose efetiva estimada ${effective.toFixed(1)} (sensibilidade ${sensitivityTag}).`
      );
      break;
    }
    case 'set_vasopressin_rate': {
      const rate = clamp(intervention.value ?? 0, 0, 0.06);
      const picked = pickOnset(next.rngState, 60, 180);
      next.rngState = picked.rngState;
      hidden.pendingVasopressinRate = rate;
      hidden.vasopressinApplyAtSec = next.timeSec + picked.onset;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Vasopressina ajustada para ${rate.toFixed(3)} U/min. Efeito esperado em ${picked.onset}s.`
      );
      break;
    }
    case 'give_fluid_bolus': {
      const effect = createEffectFromIntervention(next.timeSec, intervention);
      if (effect) {
        next.scheduledEffects.push(effect);
      }
      const volumeMl = clamp(intervention.volumeMl ?? 250, 50, 1500);
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Bolus ${volumeMl} mL iniciado. Efeito hemodinamico esperado em 10-120s com pico progressivo.`
      );
      break;
    }
    case 'give_transfusion': {
      const targetHb = intervention.targetHb ?? 0;
      const effect = createEffectFromIntervention(next.timeSec, intervention);
      if (effect) {
        const requestedRise = effect.channels.hb ?? 0;
        if (requestedRise > 0) {
          if (targetHb > 0) {
            const deficit = targetHb - hidden.hemoglobin;
            if (deficit <= 0) {
              effect.channels.hb = 0;
            } else {
              const asymptoticFraction =
                1 - Math.exp(-deficit / Math.max(requestedRise * 0.45, 0.12));
              effect.channels.hb = clamp(requestedRise * asymptoticFraction, 0, requestedRise);
            }
          }
        }
        next.scheduledEffects.push(effect);
      }
      const units = clamp(intervention.units ?? 1, 1, 2);
      const suffix = targetHb > 0 ? ` alvo Hb ${targetHb.toFixed(1)} g/dL.` : '';
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Transfusao ${units}U iniciada. Efeito em Hb/DO2 esperado em 5-20 min.${suffix}`
      );
      break;
    }
    case 'set_fio2': {
      const value = clamp(intervention.value ?? hidden.ventilatorFio2Target, 0.21, 1);
      hidden.ventilatorFio2Target = value;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `FiO2 ajustada para ${(value * 100).toFixed(0)}%. Estabilizacao em 20-60s.`
      );
      break;
    }
    case 'set_peep': {
      const value = clamp(intervention.value ?? hidden.ventilatorPeepTarget, 5, 20);
      hidden.ventilatorPeepTarget = value;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `PEEP ajustada para ${value.toFixed(0)} cmH2O. Efeito hemodinamico em 30-120s.`
      );
      break;
    }
    case 'set_vt': {
      const value = clamp(intervention.value ?? hidden.ventilatorVtTarget, 280, 750);
      hidden.ventilatorVtTarget = value;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `VT ajustado para ${value.toFixed(0)} mL. Reequilibrio ventilatorio em 30-90s.`
      );
      break;
    }
    default:
      break;
  }

  return next;
};
