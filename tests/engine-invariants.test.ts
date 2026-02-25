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

describe('engine invariants', () => {
  const caseData = sepsisAdvanced as CaseData;

  test('fluid bolus tends to increase preload (GEDI)', () => {
    const base = runForSeconds(initializeCase(caseData, 123), 240);
    const withBolus = runForSeconds(
      applyIntervention(initializeCase(caseData, 123), { type: 'give_fluid_bolus', volumeMl: 500 }),
      240
    );

    expect(withBolus.visible.gedi).toBeGreaterThan(base.visible.gedi);
  });

  test('norepinephrine dose tends to increase SVR and MAP after latency window', () => {
    const baseline = runForSeconds(initializeCase(caseData, 777), 360);
    const withNorad = runForSeconds(
      applyIntervention(initializeCase(caseData, 777), {
        type: 'set_norepinephrine_rate',
        value: 0.22
      }),
      360
    );

    expect(withNorad.visible.svr).toBeGreaterThan(baseline.visible.svr);
    expect(withNorad.visible.map).toBeGreaterThan(baseline.visible.map);
  });

  test('transfusion increases Hb and DO2', () => {
    const baseline = runForSeconds(initializeCase(caseData, 9001), 1200);
    const withTransfusion = runForSeconds(
      applyIntervention(initializeCase(caseData, 9001), { type: 'give_transfusion', units: 1 }),
      1200
    );

    expect(withTransfusion.visible.hb).toBeGreaterThan(baseline.visible.hb);
    expect(withTransfusion.visible.do2).toBeGreaterThan(baseline.visible.do2);
  });

  test('large crystalloid bolus causes measurable hemodilution', () => {
    const baseline = runForSeconds(initializeCase(caseData, 321), 420);
    const withLargeBolus = runForSeconds(
      applyIntervention(
        applyIntervention(initializeCase(caseData, 321), { type: 'give_fluid_bolus', volumeMl: 1000 }),
        { type: 'give_fluid_bolus', volumeMl: 1000 }
      ),
      420
    );

    expect(withLargeBolus.visible.hb).toBeLessThan(baseline.visible.hb - 0.25);
  });

  test('target Hb in transfusion constrains Hb rise compared with liberal target', () => {
    const restrictive = runForSeconds(
      applyIntervention(initializeCase(caseData, 909), {
        type: 'give_transfusion',
        units: 2,
        targetHb: 8.5
      }),
      1600
    );
    const liberal = runForSeconds(
      applyIntervention(initializeCase(caseData, 909), {
        type: 'give_transfusion',
        units: 2,
        targetHb: 10.5
      }),
      1600
    );

    expect(liberal.visible.hb).toBeGreaterThan(restrictive.visible.hb + 0.2);
  });

  test('ventilation adjustment shifts gasometry in expected direction', () => {
    const baseline = runForSeconds(initializeCase(caseData, 4567), 360);
    const withHigherVt = runForSeconds(
      applyIntervention(initializeCase(caseData, 4567), {
        type: 'set_vt',
        value: 620
      }),
      360
    );

    expect(withHigherVt.visible.paco2).toBeLessThan(baseline.visible.paco2);
    expect(withHigherVt.visible.ph).toBeGreaterThanOrEqual(baseline.visible.ph - 0.02);
  });

  test('higher norepinephrine dose generally yields higher MAP than low dose for same seed', () => {
    const lowDose = runForSeconds(
      applyIntervention(initializeCase(caseData, 456), {
        type: 'set_norepinephrine_rate',
        value: 0.05
      }),
      420
    );

    const highDose = runForSeconds(
      applyIntervention(initializeCase(caseData, 456), {
        type: 'set_norepinephrine_rate',
        value: 0.2
      }),
      420
    );

    expect(highDose.visible.map).toBeGreaterThan(lowDose.visible.map);
  });
});
