import {
  deriveDisplayVarsFromTrendPoint,
  DerivedDisplayVars,
  DisplayRangeKey
} from '@/sim/displayVars';
import { TrendPoint } from '@/sim/types';

export type MonitorMetricKey = keyof DerivedDisplayVars;

export interface MonitorMetricDefinition {
  key: MonitorMetricKey;
  label: string;
  fullName: string;
  unit?: string;
  decimals: number;
  color: string;
  rangeKey: DisplayRangeKey;
  size?: 'primary' | 'secondary' | 'standard' | 'compact';
}

export interface MonitorSectionDefinition {
  id: 'macro' | 'volumetric' | 'oxygen' | 'abg' | 'pulmonary';
  title: string;
  columnsMinWidth: number;
  metrics: readonly MonitorMetricDefinition[];
}

export const monitorSections: readonly MonitorSectionDefinition[] = [
  {
    id: 'macro',
    title: 'Macro-hemodinamica',
    columnsMinWidth: 220,
    metrics: [
      {
        key: 'map',
        label: 'PAM',
        fullName: 'Pressao arterial media',
        unit: 'mmHg',
        decimals: 0,
        color: '#f8c05f',
        rangeKey: 'map',
        size: 'primary'
      },
      {
        key: 'co',
        label: 'DC',
        fullName: 'Debito cardiaco',
        unit: 'L/min',
        decimals: 2,
        color: '#46c2ff',
        rangeKey: 'co',
        size: 'secondary'
      },
      {
        key: 'ci',
        label: 'IC',
        fullName: 'Indice cardiaco',
        unit: 'L/min/m²',
        decimals: 2,
        color: '#77c8ff',
        rangeKey: 'ci',
        size: 'secondary'
      },
      {
        key: 'hr',
        label: 'FC',
        fullName: 'Frequencia cardiaca',
        unit: 'bpm',
        decimals: 0,
        color: '#98d3ff',
        rangeKey: 'hr'
      },
      {
        key: 'sv',
        label: 'VS',
        fullName: 'Volume sistolico',
        unit: 'mL',
        decimals: 0,
        color: '#63b2ff',
        rangeKey: 'sv'
      },
      {
        key: 'svi',
        label: 'IVS',
        fullName: 'Indice de volume sistolico',
        unit: 'mL/m²',
        decimals: 1,
        color: '#83a7ff',
        rangeKey: 'svi'
      },
      {
        key: 'svr',
        label: 'RVS',
        fullName: 'Resistencia vascular sistemica',
        unit: 'dyn·s/cm⁵',
        decimals: 0,
        color: '#96a6ff',
        rangeKey: 'svr'
      },
      {
        key: 'svri',
        label: 'IRVS',
        fullName: 'Indice de resistencia vascular sistemica',
        unit: 'dyn·s·m²/cm⁵',
        decimals: 0,
        color: '#8f9cfb',
        rangeKey: 'svri'
      },
      {
        key: 'cvp',
        label: 'PVC',
        fullName: 'Pressao venosa central',
        unit: 'mmHg',
        decimals: 0,
        color: '#ffbf7f',
        rangeKey: 'cvp'
      },
      {
        key: 'cpo',
        label: 'CPO',
        fullName: 'Cardiac power output',
        unit: 'W',
        decimals: 2,
        color: '#d1a5ff',
        rangeKey: 'cpo',
        size: 'compact'
      },
      {
        key: 'cpi',
        label: 'CPI',
        fullName: 'Cardiac power index',
        unit: 'W/m²',
        decimals: 2,
        color: '#bc8cff',
        rangeKey: 'cpi',
        size: 'compact'
      }
    ]
  },
  {
    id: 'volumetric',
    title: 'Volumetrico',
    columnsMinWidth: 220,
    metrics: [
      {
        key: 'svv',
        label: 'VVS',
        fullName: 'Variacao do volume sistolico',
        unit: '%',
        decimals: 1,
        color: '#ffca6b',
        rangeKey: 'svv',
        size: 'secondary'
      },
      {
        key: 'gedi',
        label: 'GEDI',
        fullName: 'Indice de volume diastolico global',
        unit: 'mL/m²',
        decimals: 0,
        color: '#ffd77d',
        rangeKey: 'gedi',
        size: 'secondary'
      },
      {
        key: 'itbv',
        label: 'ITBV',
        fullName: 'Volume sanguineo intratoracico',
        unit: 'mL',
        decimals: 0,
        color: '#f6ca62',
        rangeKey: 'itbv'
      },
      {
        key: 'itbvi',
        label: 'ITBVI',
        fullName: 'Indice de volume sanguineo intratoracico',
        unit: 'mL/m²',
        decimals: 0,
        color: '#e3b656',
        rangeKey: 'itbvi'
      },
      {
        key: 'evlw',
        label: 'EVLW',
        fullName: 'Agua pulmonar extravascular',
        unit: 'mL/kg',
        decimals: 1,
        color: '#f99f7d',
        rangeKey: 'evlw',
        size: 'secondary'
      },
      {
        key: 'pvpi',
        label: 'PVPI',
        fullName: 'Indice de permeabilidade vascular pulmonar',
        decimals: 2,
        color: '#ffc46b',
        rangeKey: 'pvpi'
      }
    ]
  },
  {
    id: 'oxygen',
    title: 'Oxigenacao E Metabolismo',
    columnsMinWidth: 220,
    metrics: [
      {
        key: 'sao2',
        label: 'SaO2',
        fullName: 'Saturacao arterial de oxigenio',
        unit: '%',
        decimals: 1,
        color: '#8fe89f',
        rangeKey: 'sao2'
      },
      {
        key: 'svo2',
        label: 'SvO2',
        fullName: 'Saturacao venosa mista de oxigenio',
        unit: '%',
        decimals: 1,
        color: '#6de38e',
        rangeKey: 'svo2'
      },
      {
        key: 'hb',
        label: 'Hb',
        fullName: 'Hemoglobina',
        unit: 'g/dL',
        decimals: 1,
        color: '#9bc5ff',
        rangeKey: 'hb'
      },
      {
        key: 'do2',
        label: 'DO2',
        fullName: 'Entrega sistemica de oxigenio',
        unit: 'mL/min',
        decimals: 0,
        color: '#78d1ff',
        rangeKey: 'do2'
      },
      {
        key: 'do2i',
        label: 'DO2I',
        fullName: 'Indice de entrega sistemica de oxigenio',
        unit: 'mL/min/m²',
        decimals: 0,
        color: '#6fc4f0',
        rangeKey: 'do2i'
      },
      {
        key: 'vo2',
        label: 'VO2',
        fullName: 'Consumo sistemico de oxigenio',
        unit: 'mL/min',
        decimals: 0,
        color: '#58d3a3',
        rangeKey: 'vo2'
      },
      {
        key: 'vo2i',
        label: 'VO2I',
        fullName: 'Indice de consumo sistemico de oxigenio',
        unit: 'mL/min/m²',
        decimals: 0,
        color: '#4ac794',
        rangeKey: 'vo2i'
      },
      {
        key: 'lactate',
        label: 'Lactato',
        fullName: 'Lactato arterial',
        unit: 'mmol/L',
        decimals: 2,
        color: '#f7766d',
        rangeKey: 'lactate',
        size: 'secondary'
      }
    ]
  },
  {
    id: 'abg',
    title: 'Gasometria',
    columnsMinWidth: 220,
    metrics: [
      {
        key: 'ph',
        label: 'pH',
        fullName: 'Potencial hidrogenionico',
        decimals: 2,
        color: '#9ed0ff',
        rangeKey: 'ph'
      },
      {
        key: 'pao2',
        label: 'PaO2',
        fullName: 'Pressao parcial arterial de oxigenio',
        unit: 'mmHg',
        decimals: 0,
        color: '#b3e08a',
        rangeKey: 'pao2'
      },
      {
        key: 'paco2',
        label: 'PaCO2',
        fullName: 'Pressao parcial arterial de dioxido de carbono',
        unit: 'mmHg',
        decimals: 0,
        color: '#a5dc8b',
        rangeKey: 'paco2'
      },
      {
        key: 'hco3',
        label: 'HCO3',
        fullName: 'Bicarbonato',
        unit: 'mEq/L',
        decimals: 1,
        color: '#9cd39f',
        rangeKey: 'hco3'
      }
    ]
  },
  {
    id: 'pulmonary',
    title: 'Pulmonar Obstrutivo',
    columnsMinWidth: 190,
    metrics: [
      {
        key: 'pvr',
        label: 'RVP',
        fullName: 'Resistencia vascular pulmonar',
        unit: 'dyn·s/cm⁵',
        decimals: 0,
        color: '#ff9f76',
        rangeKey: 'pvr',
        size: 'compact'
      },
      {
        key: 'pvri',
        label: 'IRVP',
        fullName: 'Indice de resistencia vascular pulmonar',
        unit: 'dyn·s·m²/cm⁵',
        decimals: 0,
        color: '#ff8c66',
        rangeKey: 'pvri',
        size: 'compact'
      }
    ]
  }
];

export const monitorMetricKeys: readonly MonitorMetricKey[] = monitorSections.flatMap((section) =>
  section.metrics.map((metric) => metric.key)
);

const downsampleSeries = (values: readonly number[], step = 2): number[] => {
  if (values.length <= 240) {
    return [...values];
  }
  const out: number[] = [];
  for (let index = 0; index < values.length; index += step) {
    out.push(values[index]);
  }
  return out;
};

export const buildDerivedHistory = (history: readonly TrendPoint[]): DerivedDisplayVars[] => {
  return history.map((point) => deriveDisplayVarsFromTrendPoint(point));
};

export const buildSeriesByMetric = (
  derivedHistory: readonly DerivedDisplayVars[],
  selectedKeys: readonly MonitorMetricKey[]
): Record<MonitorMetricKey, number[]> => {
  const output = {} as Record<MonitorMetricKey, number[]>;
  for (const key of selectedKeys) {
    output[key] = downsampleSeries(derivedHistory.map((row) => row[key]));
  }
  return output;
};
