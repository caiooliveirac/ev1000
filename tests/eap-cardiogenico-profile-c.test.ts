import { describe, expect, test } from 'vitest';
import eapCardiogenicCase from '@/cases/eap-cardiogenico.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const runForSeconds = (state: PatientState, seconds: number): PatientState => {
  let current = state;
  for (let i = 0; i < seconds; i += 1) {
    current = step(current, 1);
  }
  return current;
};

describe('EAP cardiogenico (perfil C) calibration', () => {
  test('retrograde pulmonary pressure (LVEDP surrogate) drives hydrostatic congestion markers', () => {
    const baseline = runForSeconds(initializeCase(eapCardiogenicCase as CaseData, 42), 1200);

    let afterloadStress = initializeCase(eapCardiogenicCase as CaseData, 42);
    afterloadStress = applyIntervention(afterloadStress, { type: 'set_norepinephrine_rate', value: 0.4 });
    afterloadStress = runForSeconds(afterloadStress, 1200);

    expect(afterloadStress.hidden.leftAtrialPressure).toBeGreaterThan(baseline.hidden.leftAtrialPressure + 4);
    expect(afterloadStress.visible.evlw).toBeGreaterThan(baseline.visible.evlw + 3);
    expect(afterloadStress.visible.cvp).toBeGreaterThan(baseline.visible.cvp + 1.4);
    expect(afterloadStress.visible.gedi).toBeGreaterThan(baseline.visible.gedi + 90);
  });

  test('dobutamine increases CO/DO2 under high afterload in profile C', () => {
    let noradOnly = initializeCase(eapCardiogenicCase as CaseData, 42);
    noradOnly = applyIntervention(noradOnly, { type: 'set_norepinephrine_rate', value: 0.4 });
    noradOnly = runForSeconds(noradOnly, 1200);

    let noradPlusDobut = initializeCase(eapCardiogenicCase as CaseData, 42);
    noradPlusDobut = applyIntervention(noradPlusDobut, { type: 'set_norepinephrine_rate', value: 0.4 });
    noradPlusDobut = applyIntervention(noradPlusDobut, { type: 'set_dobutamine_rate', value: 10 });
    noradPlusDobut = runForSeconds(noradPlusDobut, 1200);

    expect(noradPlusDobut.visible.cardiacOutput).toBeGreaterThan(noradOnly.visible.cardiacOutput + 0.05);
    expect(noradPlusDobut.visible.do2).toBeGreaterThan(noradOnly.visible.do2 + 8);
  });

  test('norepinephrine remains hemodynamically active in severe cardiogenic profile C', () => {
    const baseline = runForSeconds(initializeCase(eapCardiogenicCase as CaseData, 77), 900);

    let withNorad = initializeCase(eapCardiogenicCase as CaseData, 77);
    withNorad = applyIntervention(withNorad, { type: 'set_norepinephrine_rate', value: 0.4 });
    withNorad = runForSeconds(withNorad, 900);

    expect(withNorad.visible.svr).toBeGreaterThan(baseline.visible.svr + 700);
    expect(withNorad.visible.map).toBeGreaterThan(baseline.visible.map + 15);
  });
});
