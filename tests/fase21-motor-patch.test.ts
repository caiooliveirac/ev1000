import { describe, expect, test } from 'vitest';
import sepsisAdvanced from '@/cases/sepsis-advanced.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const runForSeconds = (
  start: PatientState,
  seconds: number
): { state: PatientState; adverseCount: number } => {
  let state = start;
  let adverseCount = 0;
  for (let i = 0; i < seconds; i += 1) {
    state = step(state, 1);
    adverseCount += state.engineEvents.filter((event) => event.kind === 'adverse').length;
  }
  return { state, adverseCount };
};

describe('fase 2.1 motor patch', () => {
  const caseData = sepsisAdvanced as CaseData;

  test('norad dose-response shows saturation and higher adverse risk at extreme doses', () => {
    const doses = [0.05, 0.2, 1.0, 2.0];

    const results = doses.map((dose) => {
      let state = initializeCase(caseData, 700);
      state = applyIntervention(state, { type: 'set_norepinephrine_rate', value: dose });
      return runForSeconds(state, 900);
    });

    const svrs = results.map((result) => result.state.visible.svr);
    const adverseCounts = results.map((result) => result.adverseCount);

    const gain1 = svrs[1] - svrs[0];
    const gain2 = svrs[2] - svrs[1];
    const gain3 = svrs[3] - svrs[2];

    expect(gain1).toBeGreaterThan(0);
    expect(gain2).toBeGreaterThan(0);
    expect(gain3).toBeGreaterThan(0);
    expect(gain3).toBeLessThan(gain2);

    expect(adverseCounts[3]).toBeGreaterThanOrEqual(adverseCounts[2]);
    expect(adverseCounts[2]).toBeGreaterThanOrEqual(adverseCounts[1]);
  });

  test('PEEP tradeoff: PaO2 improves while VR/DC can drop in a subset of seeds', () => {
    let observedTradeoff = false;

    for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
      const baseline = runForSeconds(initializeCase(caseData, seed), 420).state;

      let withPeep = initializeCase(caseData, seed);
      withPeep = applyIntervention(withPeep, { type: 'set_peep', value: 16 });
      withPeep = runForSeconds(withPeep, 420).state;

      const pao2Up = withPeep.visible.pao2 > baseline.visible.pao2;
      const hemoDown =
        withPeep.hidden.venousReturnFlow < baseline.hidden.venousReturnFlow ||
        withPeep.visible.cardiacOutput < baseline.visible.cardiacOutput;

      if (pao2Up && hemoDown) {
        observedTradeoff = true;
        break;
      }
    }

    expect(observedTradeoff).toBe(true);
  });
});
