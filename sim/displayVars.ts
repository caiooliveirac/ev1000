import { PatientState } from '@/engine/types';
import { TrendPoint } from '@/sim/types';

export interface DisplayInput {
  bsa: number;
  hr: number;
  cardiacOutput: number;
  map: number;
  cvp: number;
  svr: number;
  pvr?: number;
  svv?: number;
  gedi?: number;
  itbv?: number;
  evlw: number;
  pvpi: number;
  hb: number;
  sao2: number;
  svo2: number;
  do2: number;
  vo2: number;
  lactate: number;
  pao2: number;
  paco2: number;
  ph: number;
  hco3: number;
  peep?: number;
}

export interface DerivedDisplayVars {
  co: number;
  ci: number;
  sv: number;
  svi: number;
  hr: number;
  cpo: number;
  cpi: number;
  map: number;
  cvp: number;
  svr: number;
  svri: number;
  pvr: number;
  pvri: number;
  svv: number;
  gedi: number;
  itbv: number;
  itbvi: number;
  evlw: number;
  pvpi: number;
  hb: number;
  sao2: number;
  svo2: number;
  do2: number;
  do2i: number;
  vo2: number;
  vo2i: number;
  lactate: number;
  ph: number;
  pao2: number;
  paco2: number;
  hco3: number;
}

export interface DisplayRange {
  lowWarn: number;
  highWarn: number;
  lowCritical: number;
  highCritical: number;
}

export type DisplayRangeKey =
  | 'co'
  | 'ci'
  | 'sv'
  | 'svi'
  | 'hr'
  | 'cpo'
  | 'cpi'
  | 'map'
  | 'cvp'
  | 'svr'
  | 'svri'
  | 'pvr'
  | 'pvri'
  | 'svv'
  | 'gedi'
  | 'itbv'
  | 'itbvi'
  | 'evlw'
  | 'pvpi'
  | 'hb'
  | 'sao2'
  | 'svo2'
  | 'do2'
  | 'do2i'
  | 'vo2'
  | 'vo2i'
  | 'lactate'
  | 'ph'
  | 'pao2'
  | 'paco2'
  | 'hco3';

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const estimateSvv = (input: DisplayInput): number => {
  const gediSignal = clamp((700 - (input.gedi ?? 700)) / 260, -0.3, 1.2);
  const peepSignal = clamp(((input.peep ?? 8) - 8) / 8, -0.2, 1.5);
  return clamp(10 + gediSignal * 12 + peepSignal * 4, 2, 40);
};

const estimateGedi = (input: DisplayInput): number => {
  const hrSafe = Math.max(input.hr, 1);
  const sv = (input.cardiacOutput * 1000) / hrSafe;
  return clamp(520 + sv * 2.4 - Math.max(0, (input.peep ?? 8) - 8) * 12, 280, 1500);
};

export const deriveDisplayVars = (input: DisplayInput): DerivedDisplayVars => {
  const bsa = Math.max(input.bsa, 1.2);
  const hr = Math.max(input.hr, 1);
  const co = Math.max(input.cardiacOutput, 0);
  const sv = (co * 1000) / hr;
  const ci = co / bsa;
  const svi = sv / bsa;
  const cpo = (input.map * co) / 451;
  const cpi = cpo / bsa;
  const svri = input.svr * bsa;
  const pvr = input.pvr ?? 220;
  const pvri = pvr * bsa;

  const gedi = input.gedi ?? estimateGedi(input);
  const itbv = input.itbv ?? gedi * 1.24;
  const itbvi = itbv / bsa;
  const svv = input.svv ?? estimateSvv({ ...input, gedi });

  const do2i = input.do2 / bsa;
  const vo2i = input.vo2 / bsa;

  return {
    co,
    ci,
    sv,
    svi,
    hr,
    cpo,
    cpi,
    map: input.map,
    cvp: input.cvp,
    svr: input.svr,
    svri,
    pvr,
    pvri,
    svv,
    gedi,
    itbv,
    itbvi,
    evlw: input.evlw,
    pvpi: input.pvpi,
    hb: input.hb,
    sao2: input.sao2,
    svo2: input.svo2,
    do2: input.do2,
    do2i,
    vo2: input.vo2,
    vo2i,
    lactate: input.lactate,
    ph: input.ph,
    pao2: input.pao2,
    paco2: input.paco2,
    hco3: input.hco3
  };
};

export const deriveDisplayVarsFromPatient = (state: PatientState): DerivedDisplayVars => {
  const v = state.visible;
  return deriveDisplayVars({
    bsa: v.bsa,
    hr: v.hr,
    cardiacOutput: v.cardiacOutput,
    map: v.map,
    cvp: v.cvp,
    svr: v.svr,
    pvr: state.hidden.pulmonaryResistance,
    svv: v.svv,
    gedi: v.gedi,
    itbv: v.itbv,
    evlw: v.evlw,
    pvpi: v.pvpi,
    hb: v.hb,
    sao2: v.sao2,
    svo2: v.svo2,
    do2: v.do2,
    vo2: v.vo2,
    lactate: v.lactate,
    pao2: v.pao2,
    paco2: v.paco2,
    ph: v.ph,
    hco3: v.hco3,
    peep: v.peep
  });
};

export const deriveDisplayVarsFromTrendPoint = (point: TrendPoint): DerivedDisplayVars => {
  return deriveDisplayVars({
    bsa: point.bsa ?? 1.9,
    hr: point.hr ?? 85,
    cardiacOutput: point.cardiacOutput,
    map: point.map,
    cvp: point.cvp ?? 8,
    svr: point.svr,
    pvr: point.pvr,
    svv: point.svv,
    gedi: point.gedi,
    itbv: point.itbv,
    evlw: point.evlw,
    pvpi: point.pvpi,
    hb: point.hb,
    sao2: point.sao2 ?? 96,
    svo2: point.svo2,
    do2: point.do2,
    vo2: point.vo2,
    lactate: point.lactate,
    pao2: point.pao2,
    paco2: point.paco2,
    ph: point.ph,
    hco3: point.hco3,
    peep: point.peep ?? 8
  });
};

export const displayVarRanges: Record<DisplayRangeKey, DisplayRange> = {
  co: { lowWarn: 3.8, highWarn: 8.5, lowCritical: 2.8, highCritical: 11 },
  ci: { lowWarn: 2.2, highWarn: 4.2, lowCritical: 1.8, highCritical: 5.2 },
  sv: { lowWarn: 55, highWarn: 110, lowCritical: 40, highCritical: 140 },
  svi: { lowWarn: 30, highWarn: 60, lowCritical: 22, highCritical: 75 },
  hr: { lowWarn: 55, highWarn: 120, lowCritical: 40, highCritical: 150 },
  cpo: { lowWarn: 0.6, highWarn: 1.4, lowCritical: 0.4, highCritical: 1.9 },
  cpi: { lowWarn: 0.32, highWarn: 0.75, lowCritical: 0.22, highCritical: 1.0 },
  map: { lowWarn: 65, highWarn: 95, lowCritical: 55, highCritical: 110 },
  cvp: { lowWarn: 5, highWarn: 12, lowCritical: 2, highCritical: 18 },
  svr: { lowWarn: 650, highWarn: 1400, lowCritical: 450, highCritical: 2200 },
  svri: { lowWarn: 1200, highWarn: 2600, lowCritical: 900, highCritical: 3500 },
  pvr: { lowWarn: 120, highWarn: 350, lowCritical: 80, highCritical: 800 },
  pvri: { lowWarn: 240, highWarn: 700, lowCritical: 150, highCritical: 1500 },
  svv: { lowWarn: 6, highWarn: 14, lowCritical: 3, highCritical: 22 },
  gedi: { lowWarn: 650, highWarn: 850, lowCritical: 450, highCritical: 1100 },
  itbv: { lowWarn: 800, highWarn: 1100, lowCritical: 600, highCritical: 1500 },
  itbvi: { lowWarn: 420, highWarn: 620, lowCritical: 300, highCritical: 800 },
  evlw: { lowWarn: 6, highWarn: 10, lowCritical: 5, highCritical: 14 },
  pvpi: { lowWarn: 1.2, highWarn: 2.8, lowCritical: 1, highCritical: 4.2 },
  hb: { lowWarn: 8, highWarn: 14, lowCritical: 6.5, highCritical: 16 },
  sao2: { lowWarn: 93, highWarn: 100, lowCritical: 88, highCritical: 100 },
  svo2: { lowWarn: 60, highWarn: 82, lowCritical: 50, highCritical: 90 },
  do2: { lowWarn: 500, highWarn: 1300, lowCritical: 350, highCritical: 1700 },
  do2i: { lowWarn: 260, highWarn: 680, lowCritical: 190, highCritical: 850 },
  vo2: { lowWarn: 150, highWarn: 320, lowCritical: 110, highCritical: 420 },
  vo2i: { lowWarn: 85, highWarn: 180, lowCritical: 60, highCritical: 230 },
  lactate: { lowWarn: 0.6, highWarn: 2.2, lowCritical: 0.4, highCritical: 4.5 },
  ph: { lowWarn: 7.32, highWarn: 7.48, lowCritical: 7.2, highCritical: 7.58 },
  pao2: { lowWarn: 70, highWarn: 140, lowCritical: 55, highCritical: 220 },
  paco2: { lowWarn: 30, highWarn: 48, lowCritical: 22, highCritical: 65 },
  hco3: { lowWarn: 20, highWarn: 30, lowCritical: 14, highCritical: 36 }
};
