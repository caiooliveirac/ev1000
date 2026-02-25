import { describe, expect, test } from 'vitest';
import { deriveDisplayVars } from '@/sim/displayVars';

describe('display variable derivation', () => {
  test('derives CI, SV and SVI from CO, HR and BSA', () => {
    const derived = deriveDisplayVars({
      bsa: 2,
      hr: 100,
      cardiacOutput: 5,
      map: 80,
      cvp: 8,
      svr: 1200,
      evlw: 8,
      pvpi: 1.8,
      hb: 10,
      sao2: 97,
      svo2: 70,
      do2: 650,
      vo2: 180,
      lactate: 2,
      pao2: 90,
      paco2: 40,
      ph: 7.4,
      hco3: 24
    });

    expect(derived.ci).toBeCloseTo(2.5, 6);
    expect(derived.sv).toBeCloseTo(50, 6);
    expect(derived.svi).toBeCloseTo(25, 6);
  });

  test('derives SVRI, CPO, DO2I and VO2I with standard formulas', () => {
    const derived = deriveDisplayVars({
      bsa: 1.8,
      hr: 90,
      cardiacOutput: 4.5,
      map: 72,
      cvp: 10,
      svr: 1000,
      pvr: 280,
      evlw: 9,
      pvpi: 2.1,
      hb: 11,
      sao2: 96,
      svo2: 66,
      do2: 720,
      vo2: 210,
      lactate: 2.5,
      pao2: 86,
      paco2: 42,
      ph: 7.35,
      hco3: 22
    });

    expect(derived.svri).toBeCloseTo(1800, 6);
    expect(derived.cpo).toBeCloseTo((72 * 4.5) / 451, 6);
    expect(derived.do2i).toBeCloseTo(400, 6);
    expect(derived.vo2i).toBeCloseTo(116.6666667, 4);
    expect(derived.pvri).toBeCloseTo(504, 6);
  });
});
