import { describe, expect, test } from 'vitest';
import eapCardiogenicCase from '@/cases/eap-cardiogenico.json';
import hypovolemicCase from '@/cases/choque-hipovolemico-hemorragico.json';
import sepsisCase from '@/cases/sepsis-advanced.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, Intervention, PatientState } from '@/engine/types';

const runForSeconds = (state: PatientState, seconds: number): PatientState => {
  let current = state;
  for (let i = 0; i < seconds; i += 1) {
    current = step(current, 1);
  }
  return current;
};

const runWithInterventions = (
  caseData: CaseData,
  seed: number,
  interventions: Intervention[],
  seconds: number
): PatientState => {
  let state = initializeCase(caseData, seed);
  for (const intervention of interventions) {
    state = applyIntervention(state, intervention);
  }
  return runForSeconds(state, seconds);
};

interface MatrixRow {
  scenario: string;
  intervention: string;
  dcBefore: number;
  dcAfter: number;
  pass: boolean;
}

describe('intervention response matrix (didatic coherence)', () => {
  test('cardiogenic baseline starts in a teachable severe-but-recoverable range', () => {
    const baseline = initializeCase(eapCardiogenicCase as CaseData, 42);

    expect(baseline.visible.map).toBeGreaterThanOrEqual(55);
    expect(baseline.visible.map).toBeLessThanOrEqual(65);
    expect(baseline.visible.cardiacOutput).toBeGreaterThanOrEqual(2);
    expect(baseline.visible.cardiacOutput).toBeLessThanOrEqual(3);
    expect(baseline.visible.gedi).toBeGreaterThanOrEqual(700);
    expect(baseline.visible.evlw).toBeGreaterThan(12);
    expect(baseline.visible.lactate).toBeGreaterThanOrEqual(2);
    expect(baseline.visible.lactate).toBeLessThanOrEqual(3);
  });

  test('adequate interventions improve trajectory and inadequate ones do not', () => {
    const rows: MatrixRow[] = [];

    const addRow = (
      scenario: string,
      intervention: string,
      before: number,
      after: number,
      pass: boolean
    ): void => {
      rows.push({ scenario, intervention, dcBefore: before, dcAfter: after, pass });
    };

    const seconds = 300;

    // A) EAP cardiogenic (profile C)
    const eapControl = runWithInterventions(eapCardiogenicCase as CaseData, 42, [], seconds);
    const eapDobu = runWithInterventions(
      eapCardiogenicCase as CaseData,
      42,
      [{ type: 'set_dobutamine_rate', value: 8 }],
      seconds
    );
    const eapDobuPass =
      eapDobu.visible.cardiacOutput >= eapControl.visible.cardiacOutput * 1.15 &&
      eapDobu.visible.strokeVolume > eapControl.visible.strokeVolume &&
      eapDobu.visible.lactate <= eapControl.visible.lactate &&
      eapDobu.visible.map >= eapControl.visible.map - 4;
    addRow(
      'EAP C',
      'Dobutamine 8 mcg/kg/min',
      eapControl.visible.cardiacOutput,
      eapDobu.visible.cardiacOutput,
      eapDobuPass
    );
    expect(eapDobu.visible.cardiacOutput).toBeGreaterThan(eapControl.visible.cardiacOutput * 1.1);

    const eapNorad = runWithInterventions(
      eapCardiogenicCase as CaseData,
      42,
      [{ type: 'set_norepinephrine_rate', value: 0.2 }],
      seconds
    );
    const eapNoradPass =
      eapNorad.visible.svr > eapControl.visible.svr * 1.25 &&
      eapNorad.visible.map > eapControl.visible.map + 10 &&
      eapNorad.visible.cardiacOutput >= eapControl.visible.cardiacOutput * 0.8;
    addRow(
      'EAP C',
      'Norad isolated',
      eapControl.visible.cardiacOutput,
      eapNorad.visible.cardiacOutput,
      eapNoradPass
    );

    const eapVolumeExcess = runWithInterventions(
      eapCardiogenicCase as CaseData,
      42,
      [
        { type: 'give_fluid_bolus', volumeMl: 1000 },
        { type: 'give_fluid_bolus', volumeMl: 1000 }
      ],
      seconds
    );
    const eapVolumePass =
      eapVolumeExcess.visible.gedi > eapControl.visible.gedi + 120 &&
      eapVolumeExcess.visible.evlw > eapControl.visible.evlw + 2 &&
      eapVolumeExcess.visible.cardiacOutput <= eapControl.visible.cardiacOutput * 1.15;
    addRow(
      'EAP C',
      'Volume excess 2000 mL',
      eapControl.visible.cardiacOutput,
      eapVolumeExcess.visible.cardiacOutput,
      eapVolumePass
    );

    // B) Sepsis advanced
    const sepsisControl = runWithInterventions(sepsisCase as CaseData, 77, [], seconds);
    const sepsisNorad = runWithInterventions(
      sepsisCase as CaseData,
      77,
      [{ type: 'set_norepinephrine_rate', value: 0.2 }],
      seconds
    );
    const sepsisNoradPass =
      sepsisNorad.visible.svr > sepsisControl.visible.svr * 1.4 &&
      sepsisNorad.visible.map > sepsisControl.visible.map + 8 &&
      sepsisNorad.visible.cardiacOutput >= sepsisControl.visible.cardiacOutput * 0.85;
    addRow(
      'Septic',
      'Norad',
      sepsisControl.visible.cardiacOutput,
      sepsisNorad.visible.cardiacOutput,
      sepsisNoradPass
    );

    const sepsisVolume = runWithInterventions(
      sepsisCase as CaseData,
      77,
      [{ type: 'give_fluid_bolus', volumeMl: 1000 }],
      seconds
    );
    const sepsisVolumePass =
      sepsisVolume.visible.gedi > sepsisControl.visible.gedi + 80 &&
      sepsisVolume.visible.cardiacOutput >= sepsisControl.visible.cardiacOutput * 1.1;
    addRow(
      'Septic',
      'Volume 1000 mL',
      sepsisControl.visible.cardiacOutput,
      sepsisVolume.visible.cardiacOutput,
      sepsisVolumePass
    );

    const septicDysCase = JSON.parse(JSON.stringify(sepsisCase)) as CaseData;
    septicDysCase.initialHidden.contractilityLV = 0.62;
    septicDysCase.initialHidden.contractilityRV = 0.68;
    const septicDysControl = runWithInterventions(septicDysCase, 77, [], seconds);
    const sepsisDobu = runWithInterventions(
      septicDysCase,
      77,
      [{ type: 'set_dobutamine_rate', value: 8 }],
      seconds
    );
    const sepsisDobuPass =
      sepsisDobu.visible.cardiacOutput >= septicDysControl.visible.cardiacOutput * 1.15 &&
      sepsisDobu.visible.svr >= septicDysControl.visible.svr * 0.85;
    addRow(
      'Septic',
      'Dobutamine 8 (myocardial dysfunction)',
      septicDysControl.visible.cardiacOutput,
      sepsisDobu.visible.cardiacOutput,
      sepsisDobuPass
    );

    // C) Hypovolemic
    const hypoControl = runWithInterventions(hypovolemicCase as CaseData, 91, [], seconds);
    const hypoVolume = runWithInterventions(
      hypovolemicCase as CaseData,
      91,
      [{ type: 'give_fluid_bolus', volumeMl: 1000 }],
      seconds
    );
    const hypoVolumePass =
      hypoVolume.visible.gedi > hypoControl.visible.gedi + 50 &&
      hypoVolume.visible.cardiacOutput >= hypoControl.visible.cardiacOutput * 1.2 &&
      hypoVolume.visible.svv < hypoControl.visible.svv - 2;
    addRow(
      'Hypovolemic',
      'Volume 1000 mL',
      hypoControl.visible.cardiacOutput,
      hypoVolume.visible.cardiacOutput,
      hypoVolumePass
    );

    const hypoNorad = runWithInterventions(
      hypovolemicCase as CaseData,
      91,
      [{ type: 'set_norepinephrine_rate', value: 0.2 }],
      seconds
    );
    const hypoNoradPass =
      hypoNorad.visible.map > hypoControl.visible.map + 10 &&
      hypoNorad.visible.cardiacOutput <= hypoControl.visible.cardiacOutput * 1.05;
    addRow(
      'Hypovolemic',
      'Norad isolated',
      hypoControl.visible.cardiacOutput,
      hypoNorad.visible.cardiacOutput,
      hypoNoradPass
    );

    console.table(
      rows.map((row) => ({
        Scenario: row.scenario,
        Intervention: row.intervention,
        DC_before: row.dcBefore.toFixed(2),
        DC_after: row.dcAfter.toFixed(2),
        Result: row.pass ? 'PASS' : 'FAIL'
      }))
    );

    expect(rows.every((row) => row.pass)).toBe(true);
  });

  test('dominant limiter and clamp logs are generated per tick under stress', () => {
    let state = initializeCase(sepsisCase as CaseData, 42);
    state = applyIntervention(state, { type: 'set_peep', value: 20 });
    state = applyIntervention(state, { type: 'set_norepinephrine_rate', value: 0.9 });
    state = runForSeconds(state, 180);

    expect(state.hidden.limiterLog.length).toBeGreaterThan(0);
    expect(state.hidden.clampLog.length).toBeGreaterThan(0);
  });
});
