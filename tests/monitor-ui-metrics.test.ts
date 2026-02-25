import { describe, expect, test } from 'vitest';
import { buildDerivedHistory, buildSeriesByMetric, monitorMetricKeys, monitorSections } from '@/ui/monitorSchema';
import { TrendPoint } from '@/sim/types';

const sampleHistory: TrendPoint[] = [
  {
    timeSec: 0,
    map: 62,
    cardiacOutput: 3.9,
    hr: 108,
    bsa: 1.92,
    svr: 980,
    cvp: 9,
    svv: 14,
    gedi: 640,
    itbv: 820,
    sao2: 95,
    peep: 8,
    pvr: 260,
    svo2: 63,
    lactate: 3.2,
    do2: 530,
    vo2: 210,
    evlw: 10.2,
    pvpi: 2.5,
    hb: 9.1,
    pao2: 82,
    paco2: 40,
    ph: 7.33,
    hco3: 20.4
  },
  {
    timeSec: 60,
    map: 67,
    cardiacOutput: 4.1,
    hr: 106,
    bsa: 1.92,
    svr: 1020,
    cvp: 8,
    svv: 12.5,
    gedi: 690,
    itbv: 860,
    sao2: 96,
    peep: 9,
    pvr: 278,
    svo2: 65,
    lactate: 3.1,
    do2: 570,
    vo2: 212,
    evlw: 10.5,
    pvpi: 2.45,
    hb: 9.2,
    pao2: 88,
    paco2: 39,
    ph: 7.35,
    hco3: 21
  }
];

describe('monitor ui metric schema', () => {
  test('has one card per derived monitor variable', () => {
    const renderedKeys = monitorSections.flatMap((section) => section.metrics.map((metric) => metric.key));
    const uniqueKeys = new Set(renderedKeys);
    const derivedKeyCount = Object.keys(buildDerivedHistory([sampleHistory[0]])[0]).length;

    expect(renderedKeys.length).toBe(uniqueKeys.size);
    expect(renderedKeys.length).toBe(monitorMetricKeys.length);
    expect(uniqueKeys.size).toBe(derivedKeyCount);
  });

  test('derived history generates trend series for all selected monitor metrics', () => {
    const derivedHistory = buildDerivedHistory(sampleHistory);
    const seriesMap = buildSeriesByMetric(derivedHistory, monitorMetricKeys);

    for (const key of monitorMetricKeys) {
      expect(seriesMap[key]).toHaveLength(sampleHistory.length);
      expect(Number.isFinite(seriesMap[key][0])).toBe(true);
    }
  });
});
