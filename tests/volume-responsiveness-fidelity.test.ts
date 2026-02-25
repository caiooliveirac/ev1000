import { describe, expect, test } from 'vitest';
import sepsisCase from '@/cases/sepsis-advanced.json';
import hypovolemicCase from '@/cases/choque-hipovolemico-hemorragico.json';
import cardiogenicCase from '@/cases/eap-cardiogenico.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const runForSeconds = (state: PatientState, seconds: number): PatientState => {
  let current = state;
  for (let i = 0; i < seconds; i += 1) {
    current = step(current, 1);
  }
  return current;
};

const peakCoDeltaPctAfterBolus = (base: PatientState, volumeMl: number, horizonSec = 420): number => {
  let bolusState = applyIntervention(base, { type: 'give_fluid_bolus', volumeMl });
  let controlState = base;
  let peakDeltaPct = 0;

  // Compare bolus vs no-bolus at the same timepoint to isolate the
  // intervention effect from any background drift.
  for (let i = 0; i < horizonSec; i += 1) {
    bolusState = step(bolusState, 1);
    controlState = step(controlState, 1);
    const controlCo = Math.max(controlState.visible.cardiacOutput, 0.1);
    const delta = ((bolusState.visible.cardiacOutput - controlCo) / controlCo) * 100;
    if (delta > peakDeltaPct) {
      peakDeltaPct = delta;
    }
  }

  return peakDeltaPct;
};

describe('volume responsiveness fidelity', () => {
  test('sepsis dose-response remains progressive without linear runaway', () => {
    const baseline = runForSeconds(initializeCase(sepsisCase as CaseData, 42), 180);
    const d500 = peakCoDeltaPctAfterBolus(baseline, 500);
    const d1000 = peakCoDeltaPctAfterBolus(baseline, 1000);
    const d2000 = peakCoDeltaPctAfterBolus(baseline, 2000);

    expect(d500).toBeGreaterThan(5);
    // In sepsis with capillary leak, the marginal CO benefit of 1000 vs 500 mL
    // is modest — 1 pp is clinically appropriate for a leaky patient.
    expect(d1000).toBeGreaterThan(d500 + 1);
    // At 2000 mL, the Starling curve plateaus/descends in septic patients due
    // to capillary leak → pulmonary oedema.  The peak CO delta should remain
    // in the same ballpark as 1000 mL (± concave saturation), not linear.
    expect(d2000).toBeGreaterThan(d500);
    expect(d2000).toBeLessThan(d500 * 3.0);
  });

  test('hypovolemic response to 1000 mL is stronger than cardiogenic profile C', () => {
    const hypoBase = runForSeconds(initializeCase(hypovolemicCase as CaseData, 42), 180);
    const cardioBase = runForSeconds(initializeCase(cardiogenicCase as CaseData, 42), 180);

    const hypoD1000 = peakCoDeltaPctAfterBolus(hypoBase, 1000);
    const cardioD1000 = peakCoDeltaPctAfterBolus(cardioBase, 1000);

    expect(hypoD1000).toBeGreaterThan(cardioD1000 + 3);
  });
});
