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
  let state = applyIntervention(base, { type: 'give_fluid_bolus', volumeMl });
  const baselineCo = Math.max(base.visible.cardiacOutput, 0.1);
  let peakCo = state.visible.cardiacOutput;

  for (let i = 0; i < horizonSec; i += 1) {
    state = step(state, 1);
    if (state.visible.cardiacOutput > peakCo) {
      peakCo = state.visible.cardiacOutput;
    }
  }

  return ((peakCo - baselineCo) / baselineCo) * 100;
};

describe('volume responsiveness fidelity', () => {
  test('sepsis dose-response remains progressive without linear runaway', () => {
    const baseline = runForSeconds(initializeCase(sepsisCase as CaseData, 42), 180);
    const d500 = peakCoDeltaPctAfterBolus(baseline, 500);
    const d1000 = peakCoDeltaPctAfterBolus(baseline, 1000);
    const d2000 = peakCoDeltaPctAfterBolus(baseline, 2000);

    expect(d500).toBeGreaterThan(5);
    expect(d1000).toBeGreaterThan(d500 + 2);
    expect(d2000).toBeGreaterThan(d1000 + 1);
    expect(d2000).toBeLessThan(d500 * 2.2);
  });

  test('hypovolemic response to 1000 mL is stronger than cardiogenic profile C', () => {
    const hypoBase = runForSeconds(initializeCase(hypovolemicCase as CaseData, 42), 180);
    const cardioBase = runForSeconds(initializeCase(cardiogenicCase as CaseData, 42), 180);

    const hypoD1000 = peakCoDeltaPctAfterBolus(hypoBase, 1000);
    const cardioD1000 = peakCoDeltaPctAfterBolus(cardioBase, 1000);

    expect(hypoD1000).toBeGreaterThan(cardioD1000 + 3);
  });
});
