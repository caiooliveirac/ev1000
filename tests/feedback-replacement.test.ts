import { describe, expect, test } from 'vitest';
import { runIntervention, tickSimulation, createSimulation } from '@/sim/simulation';

describe('feedback render replacement behavior', () => {
  test('tick replaces previous feedback text at cadence checkpoints (no append)', () => {
    const sim = createSimulation('sepsis_advanced', 77);
    const withLegacy = { ...sim, feedback: 'LEGACY_FEEDBACK_TEXT' };

    const afterFirstTick = tickSimulation(withLegacy, 1);
    expect(afterFirstTick.feedback).toBe('LEGACY_FEEDBACK_TEXT');
    expect(afterFirstTick.lastFeedbackAtSec).toBe(0);

    let next = afterFirstTick;
    for (let i = 0; i < 4; i += 1) {
      next = tickSimulation(next, 1);
    }

    expect(next.feedback).toContain('ESTADO HEMODINAMICO:');
    expect(next.feedback).toContain('MECANISMO DOMINANTE:');
    expect(next.feedback).toContain('PERFUSAO TECIDUAL:');
    expect(next.feedback).toContain('IMPLICACAO CLINICA:');
    expect(next.feedback).not.toContain('LEGACY_FEEDBACK_TEXT');
    expect(next.feedback.split('ESTADO HEMODINAMICO:').length - 1).toBe(1);
  });

  test('intervention update keeps feedback as current-state summary while timeline keeps action log', () => {
    const sim = createSimulation('sepsis_advanced', 78);
    const withLegacy = { ...sim, feedback: 'OLD_BLOCK' };

    const next = runIntervention(withLegacy, { type: 'set_norepinephrine_rate', value: 0.2 });
    const latestTimeline = next.timeline[next.timeline.length - 1];

    expect(next.feedback).toContain('ESTADO HEMODINAMICO:');
    expect(next.feedback).not.toContain('OLD_BLOCK');
    expect(latestTimeline.message.toLowerCase()).toContain('norad ajustada');
  });
});
