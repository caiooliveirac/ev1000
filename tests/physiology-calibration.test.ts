import { describe, expect, test } from 'vitest';
import hypovolemicCase from '@/cases/choque-hipovolemico-hemorragico.json';
import lowOutputCardiogenicCase from '@/cases/eap-perfil-l.json';
import tepCase from '@/cases/tep-macico-obstrutivo.json';
import sepsisCase from '@/cases/sepsis-advanced.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const runForSeconds = (state: PatientState, seconds: number): PatientState => {
  let current = state;
  for (let i = 0; i < seconds; i += 1) {
    current = step(current, 1);
  }
  return current;
};

describe('physiology calibration (motor only)', () => {
  test('hypovolemic profile responds strongly to volume while cardiogenic response is limited', () => {
    const hypo = hypovolemicCase as CaseData;
    const cardio = lowOutputCardiogenicCase as CaseData;
    const seed = 2026;

    const hypoBase = runForSeconds(initializeCase(hypo, seed), 420);
    const hypoBolus = runForSeconds(
      applyIntervention(initializeCase(hypo, seed), { type: 'give_fluid_bolus', volumeMl: 1000 }),
      420
    );

    const cardioBase = runForSeconds(initializeCase(cardio, seed), 420);
    const cardioBolus = runForSeconds(
      applyIntervention(initializeCase(cardio, seed), { type: 'give_fluid_bolus', volumeMl: 1000 }),
      420
    );

    const hypoDeltaCo = hypoBolus.visible.cardiacOutput - hypoBase.visible.cardiacOutput;
    const cardioDeltaCo = cardioBolus.visible.cardiacOutput - cardioBase.visible.cardiacOutput;
    const cardioDeltaGedi = cardioBolus.visible.gedi - cardioBase.visible.gedi;

    expect(hypoDeltaCo).toBeGreaterThan(0.18);
    expect(hypoDeltaCo).toBeGreaterThan(cardioDeltaCo + 0.15);
    expect(cardioDeltaGedi).toBeGreaterThan(12);
    expect(cardioDeltaCo).toBeLessThan(0.2);
  });

  test('TEP-like high PVR state depresses CO primarily through pulmonary afterload', () => {
    const baseTep = runForSeconds(initializeCase(tepCase as CaseData, 808), 300);
    const highPeepTep = runForSeconds(
      applyIntervention(initializeCase(tepCase as CaseData, 808), { type: 'set_peep', value: 16 }),
      300
    );

    expect(highPeepTep.hidden.pulmonaryResistance).toBeGreaterThan(baseTep.hidden.pulmonaryResistance + 120);
    expect(highPeepTep.visible.cardiacOutput).toBeLessThan(baseTep.visible.cardiacOutput);
    expect(baseTep.visible.svr).toBeGreaterThan(700);
  });

  test('critical DO2 triggers supply dependency pattern with delayed lactate rise', () => {
    const lowDo2Case = JSON.parse(JSON.stringify(sepsisCase)) as CaseData;
    lowDo2Case.initialHidden.hemoglobin = 7.1;
    lowDo2Case.initialHidden.contractilityLV = 0.42;
    lowDo2Case.initialHidden.bloodVolume = 3900;
    lowDo2Case.initialHidden.criticalDo2 = 420;
    lowDo2Case.initialHidden.oxygenDemandBase = 260;

    let lowDo2 = initializeCase(lowDo2Case, 909);
    const lact0 = lowDo2.visible.lactate;
    lowDo2 = runForSeconds(lowDo2, 10);
    const lact10 = lowDo2.visible.lactate;
    lowDo2 = runForSeconds(lowDo2, 50);
    const lact60 = lowDo2.visible.lactate;
    lowDo2 = runForSeconds(lowDo2, 300);
    const lact360 = lowDo2.visible.lactate;

    const reference = runForSeconds(initializeCase(sepsisCase as CaseData, 909), 360);

    expect(lowDo2.visible.do2).toBeLessThan(lowDo2.hidden.criticalDo2 * 1.05);
    expect(lowDo2.visible.vo2).toBeLessThan(reference.visible.vo2 - 3);
    expect(lowDo2.hidden.supplyDependencyIndex).toBeGreaterThan(reference.hidden.supplyDependencyIndex + 0.03);
    expect(lact10 - lact0).toBeLessThan(0.2);
    expect(lact360 - lact60).toBeGreaterThan(lact10 - lact0);
  });
});
