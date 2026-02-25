import { describe, expect, test } from 'vitest';
import sepsisAdvanced from '@/cases/sepsis-advanced.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, Intervention, PatientState } from '@/engine/types';

interface TracePoint {
  t: number;
  map: number;
  co: number;
  svr: number;
  svo2: number;
  do2: number;
  lactate: number;
}

const buildTrace = (seed: number): TracePoint[] => {
  const caseData = sepsisAdvanced as CaseData;
  let state: PatientState = initializeCase(caseData, seed);

  const interventionsBySecond: Record<number, Intervention> = {
    15: { type: 'set_norepinephrine_rate', value: 0.16 },
    50: { type: 'give_fluid_bolus', volumeMl: 500 },
    120: { type: 'set_dobutamine_rate', value: 7 },
    170: { type: 'set_fio2', value: 0.6 },
    200: { type: 'set_peep', value: 10 },
    220: { type: 'give_transfusion', units: 1, targetHb: 8 }
  };

  const trace: TracePoint[] = [];

  for (let second = 1; second <= 300; second += 1) {
    const intervention = interventionsBySecond[second];
    if (intervention) {
      state = applyIntervention(state, intervention);
    }

    state = step(state, 1);

    if (second % 30 === 0) {
      trace.push({
        t: second,
        map: Number(state.visible.map.toFixed(2)),
        co: Number(state.visible.cardiacOutput.toFixed(2)),
        svr: Number(state.visible.svr.toFixed(2)),
        svo2: Number(state.visible.svo2.toFixed(2)),
        do2: Number(state.visible.do2.toFixed(2)),
        lactate: Number(state.visible.lactate.toFixed(3))
      });
    }
  }

  return trace;
};

describe('deterministic run (5 min, fixed seed)', () => {
  test('produces identical trajectory for same seed and intervention timeline', () => {
    const runA = buildTrace(42);
    const runB = buildTrace(42);
    const runOtherSeed = buildTrace(43);

    expect(runA).toEqual(runB);
    expect(runA).not.toEqual(runOtherSeed);
    expect(runA).toHaveLength(10);
    expect(runA.map((point) => point.t)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);

    const first = runA[0];
    const last = runA[runA.length - 1];
    expect(last.t).toBe(300);
    expect(last.co).not.toBe(first.co);
    expect(last.map).not.toBe(first.map);
  });
});
