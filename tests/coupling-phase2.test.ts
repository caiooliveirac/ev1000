import { describe, expect, test } from 'vitest';
import sepsisAdvanced from '@/cases/sepsis-advanced.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const runForSeconds = (state: PatientState, seconds: number): PatientState => {
  let current = state;
  for (let i = 0; i < seconds; i += 1) {
    current = step(current, 1);
  }
  return current;
};

const cloneCase = (): CaseData => JSON.parse(JSON.stringify(sepsisAdvanced)) as CaseData;

describe('phase 2 coupling behavior', () => {
  test('higher PEEP improves PaO2 but can reduce CO when venous compliance is low', () => {
    const caseData = cloneCase();
    caseData.initialHidden.venousCompliance = 0.7;
    caseData.initialHidden.ardsSeverity = 0.55;

    const baseline = runForSeconds(initializeCase(caseData, 121), 360);

    let withPeep = initializeCase(caseData, 121);
    withPeep = applyIntervention(withPeep, { type: 'set_peep', value: 14 });
    withPeep = runForSeconds(withPeep, 360);

    expect(withPeep.visible.pao2).toBeGreaterThan(baseline.visible.pao2);
    expect(withPeep.visible.cardiacOutput).toBeLessThan(baseline.visible.cardiacOutput);
  });

  test('cardiogenic profile has weak volume responsiveness and tends to increase EVLW after bolus', () => {
    const cardiogenic = cloneCase();
    cardiogenic.initialHidden.contractilityLV = 0.42;
    cardiogenic.initialHidden.contractilityRV = 0.55;
    cardiogenic.initialHidden.lvCompliance = 0.55;
    cardiogenic.initialHidden.basalSVR = 1300;
    cardiogenic.initialHidden.leftAtrialPressure = 16;
    cardiogenic.initialHidden.capillaryLeak = 0.35;
    cardiogenic.initialHidden.venousCompliance = 0.95;

    const baseline = runForSeconds(initializeCase(cardiogenic, 321), 600);

    let withBolus = initializeCase(cardiogenic, 321);
    withBolus = applyIntervention(withBolus, { type: 'give_fluid_bolus', volumeMl: 1000 });
    withBolus = runForSeconds(withBolus, 600);

    const deltaCo = withBolus.visible.cardiacOutput - baseline.visible.cardiacOutput;
    expect(deltaCo).toBeLessThan(0.45);
    expect(withBolus.visible.evlw).toBeGreaterThan(baseline.visible.evlw + 0.4);
  });

  test('TEP-like high PVR state reduces CO, increases RAP(CVP), and lowers LV preload', () => {
    const normal = cloneCase();

    const tepLike = cloneCase();
    tepLike.initialHidden.basalPVR = 900;
    tepLike.initialHidden.pulmonaryResistance = 900;
    tepLike.initialHidden.ardsSeverity = 0.2;
    tepLike.initialHidden.functionalShunt = 0.16;

    const normalState = runForSeconds(initializeCase(normal, 5150), 300);
    const tepState = runForSeconds(initializeCase(tepLike, 5150), 300);

    expect(tepState.visible.cardiacOutput).toBeLessThan(normalState.visible.cardiacOutput);
    expect(tepState.visible.cvp).toBeGreaterThan(normalState.visible.cvp);
    expect(tepState.hidden.leftVentricularPreload).toBeLessThan(normalState.hidden.leftVentricularPreload);
  });
});
