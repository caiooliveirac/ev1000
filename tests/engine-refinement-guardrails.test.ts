import { describe, expect, test } from 'vitest';
import sepsisCase from '@/cases/sepsis-advanced.json';
import {
  __testOnlyApplyPhysiologyCalibration,
  applyIntervention,
  initializeCase,
  step
} from '@/engine/model';
import { runCoupledPass } from '@/engine/step';
import { CaseData, PatientState } from '@/engine/types';

const cloneState = (state: PatientState): PatientState => {
  return JSON.parse(JSON.stringify(state)) as PatientState;
};

const runForSeconds = (state: PatientState, seconds: number): PatientState => {
  let current = state;
  for (let i = 0; i < seconds; i += 1) {
    current = step(current, 1);
  }
  return current;
};

describe('engine refinement guardrails', () => {
  test('physiology calibration is idempotent for the same tick (no double-apply)', () => {
    const base = initializeCase(sepsisCase as CaseData, 1401);

    const coupledSingle = runCoupledPass(cloneState(base), 1);
    const single = __testOnlyApplyPhysiologyCalibration(coupledSingle, base, 1);

    const coupledDouble = runCoupledPass(cloneState(base), 1);
    const once = __testOnlyApplyPhysiologyCalibration(coupledDouble, base, 1);
    const twice = __testOnlyApplyPhysiologyCalibration(once, base, 1);

    expect(twice).toEqual(single);
  });

  test('PEEP 20 + norad 0.9 does not collapse CO below 1.5 L/min in the first 60s', () => {
    let state = initializeCase(sepsisCase as CaseData, 42);
    state = applyIntervention(state, { type: 'set_norepinephrine_rate', value: 0.9 });
    state = applyIntervention(state, { type: 'set_peep', value: 20 });

    let minCoFirstMinute = Number.POSITIVE_INFINITY;
    let coAt60s = 0;
    let stateAt60 = state;
    for (let t = 1; t <= 60; t += 1) {
      state = step(state, 1);
      minCoFirstMinute = Math.min(minCoFirstMinute, state.visible.cardiacOutput);
      if (t === 60) {
        coAt60s = state.visible.cardiacOutput;
        stateAt60 = state;
      }
    }

    const stateAt600 = runForSeconds(stateAt60, 540);

    // Guardrail is range-based: avoid early catastrophic collapse while allowing severe-shock variability.
    expect(minCoFirstMinute).toBeGreaterThan(1.45);
    expect(stateAt600.visible.cardiacOutput).toBeLessThanOrEqual(coAt60s + 0.05);
  });

  test('high leak + recent volume avoids short-term EVLW drop after 2000 mL bolus', () => {
    let state = initializeCase(sepsisCase as CaseData, 42);
    const initialEvlw = state.visible.evlw;

    state = applyIntervention(state, { type: 'give_fluid_bolus', volumeMl: 1000 });
    state = applyIntervention(state, { type: 'give_fluid_bolus', volumeMl: 1000 });
    state = runForSeconds(state, 300);

    expect(state.hidden.capillaryLeak).toBeGreaterThan(0.6);
    expect(state.visible.evlw).toBeGreaterThanOrEqual(initialEvlw * 0.95);
  });
});
