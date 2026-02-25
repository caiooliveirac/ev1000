import { describe, expect, test } from 'vitest';
import sepsis from '@/cases/sepsis-advanced.json';
import tep from '@/cases/tep-macico-obstrutivo.json';
import { initializeCase } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';
import { generateClinicalFeedback } from '@/sim/feedback';
import { TrendPoint } from '@/sim/types';

const cloneState = (state: PatientState): PatientState => {
  return JSON.parse(JSON.stringify(state)) as PatientState;
};

const pointFromState = (
  state: PatientState,
  timeSec: number,
  overrides: Partial<TrendPoint> = {}
): TrendPoint => {
  const v = state.visible;
  return {
    timeSec,
    map: v.map,
    cardiacOutput: v.cardiacOutput,
    svr: v.svr,
    svo2: v.svo2,
    lactate: v.lactate,
    do2: v.do2,
    vo2: v.vo2,
    evlw: v.evlw,
    pvpi: v.pvpi,
    hb: v.hb,
    pao2: v.pao2,
    paco2: v.paco2,
    ph: v.ph,
    hco3: v.hco3,
    ...overrides
  };
};

describe('clinical feedback temporal and contextual logic', () => {
  test('feedback message always follows structured 4-block format', () => {
    const prev = initializeCase(sepsis as CaseData, 1201);
    prev.timeSec = 120;

    const curr = cloneState(prev);
    curr.timeSec = 121;
    curr.visible.map -= 3;
    curr.visible.cardiacOutput -= 0.2;
    curr.visible.lactate += 0.06;
    curr.visible.do2 -= 35;

    const history: TrendPoint[] = [
      pointFromState(prev, 70, { map: 64, cardiacOutput: 4.1, lactate: 3.15, do2: 520, svr: 900, vo2: 230 }),
      pointFromState(prev, 85, { map: 62, cardiacOutput: 3.95, lactate: 3.2, do2: 500, svr: 930, vo2: 224 }),
      pointFromState(prev, 100, { map: 60, cardiacOutput: 3.75, lactate: 3.28, do2: 470, svr: 980, vo2: 214 }),
      pointFromState(prev, 115, { map: 58, cardiacOutput: 3.55, lactate: 3.38, do2: 450, svr: 1040, vo2: 205 })
    ];

    const result = generateClinicalFeedback(prev, curr, 'sepsis_advanced', history);
    expect(result.message).toContain('ESTADO HEMODINAMICO:');
    expect(result.message).toContain('MECANISMO DOMINANTE:');
    expect(result.message).toContain('PERFUSAO TECIDUAL:');
    expect(result.message).toContain('IMPLICACAO CLINICA:');
    expect(result.message).not.toContain('Sem alteracao');
  });

  test('severe hypotension + low CO is flagged as grave shock with imminent risk', () => {
    const prev = initializeCase(sepsis as CaseData, 1202);
    prev.timeSec = 300;

    const curr = cloneState(prev);
    curr.timeSec = 301;
    curr.visible.map = 47;
    curr.visible.cardiacOutput = 2.2;
    curr.visible.lactate = 5.1;
    curr.visible.do2 = 250;

    const history: TrendPoint[] = [
      pointFromState(prev, 250, { map: 60, cardiacOutput: 3.4, lactate: 4.0, do2: 390, svr: 980, vo2: 220 }),
      pointFromState(prev, 270, { map: 56, cardiacOutput: 3.0, lactate: 4.4, do2: 345, svr: 1080, vo2: 205 }),
      pointFromState(prev, 290, { map: 52, cardiacOutput: 2.6, lactate: 4.8, do2: 300, svr: 1180, vo2: 188 })
    ];

    const result = generateClinicalFeedback(prev, curr, 'sepsis_advanced', history);
    expect(result.clinicalImplication.toLowerCase()).toContain('choque profundo');
    expect(result.clinicalImplication.toLowerCase()).toContain('pam <50');
  });

  test('DO2 near critical with falling VO2 triggers supply dependency warning', () => {
    const prev = initializeCase(sepsis as CaseData, 1203);
    prev.timeSec = 500;
    prev.hidden.criticalDo2 = 340;

    const curr = cloneState(prev);
    curr.timeSec = 501;
    curr.hidden.criticalDo2 = 340;
    curr.hidden.supplyDependencyIndex = 0.62;
    curr.visible.do2 = 330;
    curr.visible.vo2 = 170;
    curr.visible.map = 58;

    const history: TrendPoint[] = [
      pointFromState(prev, 445, { do2: 460, vo2: 225, map: 66, cardiacOutput: 4.2, lactate: 3.1, svr: 920 }),
      pointFromState(prev, 460, { do2: 420, vo2: 214, map: 64, cardiacOutput: 4.0, lactate: 3.2, svr: 950 }),
      pointFromState(prev, 475, { do2: 390, vo2: 198, map: 62, cardiacOutput: 3.7, lactate: 3.35, svr: 1010 }),
      pointFromState(prev, 490, { do2: 355, vo2: 182, map: 60, cardiacOutput: 3.4, lactate: 3.5, svr: 1090 })
    ];

    const result = generateClinicalFeedback(prev, curr, 'sepsis_advanced', history);
    expect(result.clinicalImplication.toLowerCase()).toContain('supply dependency');
  });

  test('continuous lactate rise is interpreted as sustained hypoperfusion', () => {
    const prev = initializeCase(sepsis as CaseData, 1204);
    prev.timeSec = 720;

    const curr = cloneState(prev);
    curr.timeSec = 721;
    curr.visible.lactate = 4.2;
    curr.visible.map = 56;
    curr.visible.cardiacOutput = 3.1;

    const history: TrendPoint[] = [
      pointFromState(prev, 660, { lactate: 3.45, map: 62, cardiacOutput: 3.9, do2: 470, svr: 940, vo2: 220 }),
      pointFromState(prev, 675, { lactate: 3.58, map: 61, cardiacOutput: 3.8, do2: 455, svr: 960, vo2: 214 }),
      pointFromState(prev, 690, { lactate: 3.72, map: 60, cardiacOutput: 3.6, do2: 430, svr: 995, vo2: 206 }),
      pointFromState(prev, 705, { lactate: 3.88, map: 58, cardiacOutput: 3.4, do2: 405, svr: 1040, vo2: 198 })
    ];

    const result = generateClinicalFeedback(prev, curr, 'sepsis_advanced', history);
    expect(result.clinicalImplication.toLowerCase()).toContain('hipoperfusao sustentada');
  });

  test('SVR up with CO down explains excessive afterload mechanism', () => {
    const prev = initializeCase(sepsis as CaseData, 1205);
    prev.timeSec = 900;
    prev.visible.svr = 900;
    prev.visible.cardiacOutput = 4.6;

    const curr = cloneState(prev);
    curr.timeSec = 901;
    curr.visible.svr = 1450;
    curr.visible.cardiacOutput = 3.2;
    curr.visible.map = 63;

    const history: TrendPoint[] = [
      pointFromState(prev, 840, { svr: 910, cardiacOutput: 4.5, map: 64, lactate: 3.2, do2: 520, vo2: 226 }),
      pointFromState(prev, 855, { svr: 1020, cardiacOutput: 4.1, map: 64, lactate: 3.25, do2: 490, vo2: 218 }),
      pointFromState(prev, 870, { svr: 1160, cardiacOutput: 3.8, map: 63, lactate: 3.35, do2: 455, vo2: 210 }),
      pointFromState(prev, 885, { svr: 1300, cardiacOutput: 3.5, map: 63, lactate: 3.46, do2: 425, vo2: 201 })
    ];

    const result = generateClinicalFeedback(prev, curr, 'sepsis_advanced', history);
    expect(`${result.dominantMechanism} ${result.trendSummary}`.toLowerCase()).toContain('pos-carga excessiva');
  });

  test('high PVR + high RAP profile is classified as obstructive shock', () => {
    const prev = initializeCase(tep as CaseData, 1206);
    prev.timeSec = 1100;

    const curr = cloneState(prev);
    curr.timeSec = 1101;
    curr.hidden.pulmonaryResistance = 1200;
    curr.hidden.rightAtrialPressure = 19;
    curr.visible.cardiacOutput = 2.5;
    curr.visible.gedi = 520;
    curr.visible.map = 57;
    curr.visible.evlw = 7.1;

    const history: TrendPoint[] = [
      pointFromState(prev, 1045, { cardiacOutput: 3.2, map: 62, lactate: 3.4, do2: 430, svr: 1180, vo2: 218 }),
      pointFromState(prev, 1060, { cardiacOutput: 3.0, map: 61, lactate: 3.5, do2: 410, svr: 1200, vo2: 210 }),
      pointFromState(prev, 1075, { cardiacOutput: 2.8, map: 60, lactate: 3.62, do2: 390, svr: 1220, vo2: 202 }),
      pointFromState(prev, 1090, { cardiacOutput: 2.7, map: 59, lactate: 3.74, do2: 370, svr: 1240, vo2: 195 })
    ];

    const result = generateClinicalFeedback(prev, curr, 'tep_obstructive', history);
    expect(result.hemodynamicState.toLowerCase()).toContain('obstrutivo');
  });
});
