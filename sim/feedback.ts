import { CaseProfile, PatientState } from '@/engine/types';
import { TrendPoint } from '@/sim/types';

const WINDOW_MIN_SEC = 30;
const WINDOW_MAX_SEC = 60;

type DriverKey =
  | 'dSVR'
  | 'dCO'
  | 'dVR'
  | 'dPVR'
  | 'dExtraction'
  | 'dShunt'
  | 'dContractility';

type ShockKey = 'distributive' | 'cardiogenic' | 'obstructive' | 'hypovolemic';

interface TrendMetric {
  start: number;
  end: number;
  delta: number;
  slopePerMin: number;
  relativeDelta: number;
}

interface ClassificationResult {
  stateLabel: string;
  severityLabel: string;
  dominantType: ShockKey;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const fmt = (value: number, digits = 2): string => value.toFixed(digits);

const pctDelta = (after: number, before: number): number => {
  const denom = Math.max(Math.abs(before), 1e-6);
  return (after - before) / denom;
};

const absPctDelta = (after: number, before: number): number => {
  return Math.abs(pctDelta(after, before));
};

const lowSignal = (value: number, pivot: number, span: number): number => {
  return clamp((pivot - value) / Math.max(span, 1e-6), 0, 1.8);
};

const highSignal = (value: number, pivot: number, span: number): number => {
  return clamp((value - pivot) / Math.max(span, 1e-6), 0, 1.8);
};

const toTrendPointFromState = (state: PatientState): TrendPoint => {
  return {
    timeSec: state.timeSec,
    map: state.visible.map,
    cardiacOutput: state.visible.cardiacOutput,
    svr: state.visible.svr,
    svo2: state.visible.svo2,
    lactate: state.visible.lactate,
    do2: state.visible.do2,
    vo2: state.visible.vo2,
    evlw: state.visible.evlw,
    pvpi: state.visible.pvpi,
    hb: state.visible.hb,
    pao2: state.visible.pao2,
    paco2: state.visible.paco2,
    ph: state.visible.ph,
    hco3: state.visible.hco3
  };
};

const buildWindow = (
  previousState: PatientState,
  currentState: PatientState,
  history: TrendPoint[]
): TrendPoint[] => {
  const byTime = new Map<number, TrendPoint>();
  for (const point of history) {
    if (point.timeSec <= currentState.timeSec) {
      byTime.set(point.timeSec, point);
    }
  }
  byTime.set(previousState.timeSec, toTrendPointFromState(previousState));
  byTime.set(currentState.timeSec, toTrendPointFromState(currentState));

  const merged = Array.from(byTime.values()).sort((a, b) => a.timeSec - b.timeSec);
  if (merged.length < 2) {
    return [toTrendPointFromState(previousState), toTrendPointFromState(currentState)];
  }

  const windowStart = currentState.timeSec - WINDOW_MAX_SEC;
  let points = merged.filter((point) => point.timeSec >= windowStart);

  const coveredSeconds = points[points.length - 1].timeSec - points[0].timeSec;
  if (coveredSeconds < WINDOW_MIN_SEC) {
    const fallbackStart = currentState.timeSec - WINDOW_MIN_SEC;
    const fallback = merged.filter((point) => point.timeSec >= fallbackStart);
    if (fallback.length >= 2) {
      points = fallback;
    }
  }

  if (points.length < 2) {
    points = merged.slice(-2);
  }

  return points;
};

const buildTrend = (points: TrendPoint[], selector: (point: TrendPoint) => number): TrendMetric => {
  const first = points[0];
  const last = points[points.length - 1];
  const start = selector(first);
  const end = selector(last);
  const delta = end - start;
  const seconds = Math.max(last.timeSec - first.timeSec, 1);
  const slopePerMin = delta / (seconds / 60);
  const relativeDelta = delta / Math.max(Math.abs(start), 1e-6);

  return {
    start,
    end,
    delta,
    slopePerMin,
    relativeDelta
  };
};

const trendDirection = (
  trend: TrendMetric,
  slopeThreshold: number
): 'up' | 'down' | 'flat' => {
  if (trend.slopePerMin > slopeThreshold) {
    return 'up';
  }
  if (trend.slopePerMin < -slopeThreshold) {
    return 'down';
  }
  return 'flat';
};

const hasSustainedRise = (
  points: TrendPoint[],
  selector: (point: TrendPoint) => number,
  minTotalRise: number,
  minStepRise: number
): boolean => {
  if (points.length < 4) {
    return false;
  }

  let rises = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (selector(points[i]) - selector(points[i - 1]) >= minStepRise) {
      rises += 1;
    }
  }

  const totalRise = selector(points[points.length - 1]) - selector(points[0]);
  return rises >= points.length - 2 && totalRise >= minTotalRise;
};

const shockTypeLabel = (shockType: ShockKey): string => {
  if (shockType === 'distributive') {
    return 'distributivo';
  }
  if (shockType === 'cardiogenic') {
    return 'cardiogenico';
  }
  if (shockType === 'obstructive') {
    return 'obstrutivo';
  }
  return 'hipovolemico';
};

const classifyState = (state: PatientState, caseProfile: CaseProfile): ClassificationResult => {
  const map = state.visible.map;
  const co = state.visible.cardiacOutput;
  const svr = state.visible.svr;
  const pvr = state.hidden.pulmonaryResistance;
  const gedi = state.visible.gedi;
  const evlw = state.visible.evlw;
  const rap = state.hidden.rightAtrialPressure;
  const extraction = state.hidden.extractionEfficiency;
  const lactate = state.visible.lactate;

  const lowCO = lowSignal(co, 3.8, 2.1);
  const lowSVR = lowSignal(svr, 900, 450);
  const highSVR = highSignal(svr, 1200, 900);
  const highPVR = highSignal(pvr, 340, 700);
  const lowGEDI = lowSignal(gedi, 680, 300);
  const highGEDI = highSignal(gedi, 850, 500);
  const highEVLW = highSignal(evlw, 10, 8);
  const lowEVLW = lowSignal(evlw, 7.5, 3);
  const highRAP = highSignal(rap, 11, 8);
  const lowRAP = lowSignal(rap, 7, 4);
  const hypotension = lowSignal(map, 65, 20);
  const lowExtraction = lowSignal(extraction, 0.65, 0.35);
  const lactateStress = highSignal(lactate, 2.2, 4.5);

  const scores: Record<ShockKey, number> = {
    distributive:
      1.2 * lowSVR +
      0.75 * hypotension +
      0.65 * lowExtraction +
      0.45 * highSignal(co, 4.8, 2.8) +
      0.35 * lactateStress,
    cardiogenic:
      1.2 * lowCO +
      1.0 * highEVLW +
      0.85 * highRAP +
      0.6 * highSVR +
      0.45 * highGEDI +
      0.3 * highSignal(state.hidden.leftAtrialPressure, 14, 9),
    obstructive:
      1.3 * highPVR +
      1.0 * highRAP +
      0.9 * lowCO +
      0.7 * lowGEDI +
      0.5 * lowSignal(state.visible.pao2, 78, 32) +
      0.25 * highSignal(state.visible.peep, 12, 8),
    hypovolemic:
      1.35 * lowGEDI +
      1.0 * lowRAP +
      0.9 * lowCO +
      0.65 * highSVR +
      0.45 * lowEVLW +
      0.35 * highSignal(state.visible.svv, 13, 12)
  };

  if (caseProfile === 'sepsis_advanced') {
    scores.distributive += 0.25;
  } else if (caseProfile === 'hypovolemic_hemorrhagic') {
    scores.hypovolemic += 0.25;
  } else if (caseProfile === 'eap_cardiogenic' || caseProfile === 'eap_low_output') {
    scores.cardiogenic += 0.25;
  } else if (caseProfile === 'tep_obstructive') {
    scores.obstructive += 0.25;
  }

  const ranking = (Object.entries(scores) as [ShockKey, number][]).sort((a, b) => b[1] - a[1]);
  const top = ranking[0];
  const second = ranking[1];

  const mixed = second && top[1] > 0 && second[1] / top[1] >= 0.82;
  const stateLabel = mixed
    ? `Choque misto (${shockTypeLabel(top[0])} + ${shockTypeLabel(second[0])})`
    : `Choque ${shockTypeLabel(top[0])} predominante`;

  let severityLabel = 'instabilidade moderada';
  if (map < 50 && co < 2.5) {
    severityLabel = 'choque profundo (PAM <50 e DC <2.5)';
  } else if (map < 55 || (co < 2.8 && lactate > 4.2)) {
    severityLabel = 'instabilidade critica';
  } else if (map < 65 || lactate > 2.5) {
    severityLabel = 'instabilidade hemodinamica ativa';
  } else {
    severityLabel = 'parcialmente compensado';
  }

  return {
    stateLabel,
    severityLabel,
    dominantType: top[0]
  };
};

const buildDominantMechanism = (
  previousState: PatientState,
  currentState: PatientState,
  mapTrend: TrendMetric,
  coTrend: TrendMetric,
  svrTrend: TrendMetric
): {
  dominantMechanism: string;
  drivers: {
    dSVR: number;
    dPVR: number;
    dVR: number;
    dContractility: number;
    dShunt: number;
  };
} => {
  const dSVR = currentState.visible.svr - previousState.visible.svr;
  const dCO = currentState.visible.cardiacOutput - previousState.visible.cardiacOutput;
  const dVR = currentState.hidden.venousReturnFlow - previousState.hidden.venousReturnFlow;
  const dPVR = currentState.hidden.pulmonaryResistance - previousState.hidden.pulmonaryResistance;
  const dExtraction =
    currentState.hidden.extractionEfficiency - previousState.hidden.extractionEfficiency;
  const dShunt =
    currentState.hidden.pulmonaryShuntFraction - previousState.hidden.pulmonaryShuntFraction;
  const dContractility = currentState.hidden.contractilityLV - previousState.hidden.contractilityLV;

  const contribution: Record<DriverKey, number> = {
    dSVR: absPctDelta(currentState.visible.svr, previousState.visible.svr) + Math.abs(svrTrend.relativeDelta) * 0.35,
    dCO:
      absPctDelta(currentState.visible.cardiacOutput, previousState.visible.cardiacOutput) +
      Math.abs(coTrend.relativeDelta) * 0.35,
    dVR:
      absPctDelta(currentState.hidden.venousReturnFlow, previousState.hidden.venousReturnFlow) +
      Math.abs(pctDelta(currentState.visible.cvp, previousState.visible.cvp)) * 0.15,
    dPVR:
      absPctDelta(currentState.hidden.pulmonaryResistance, previousState.hidden.pulmonaryResistance) +
      Math.abs(pctDelta(currentState.visible.pao2, previousState.visible.pao2)) * 0.1,
    dExtraction: absPctDelta(
      currentState.hidden.extractionEfficiency,
      previousState.hidden.extractionEfficiency
    ),
    dShunt: absPctDelta(
      currentState.hidden.pulmonaryShuntFraction,
      previousState.hidden.pulmonaryShuntFraction
    ),
    dContractility: absPctDelta(currentState.hidden.contractilityLV, previousState.hidden.contractilityLV)
  };

  const dominantDriver = Object.entries(contribution).sort((a, b) => b[1] - a[1])[0][0] as DriverKey;

  let dominantMechanism = '';
  if (dominantDriver === 'dSVR') {
    dominantMechanism =
      dSVR > 0
        ? `SVR em alta (${fmt(currentState.visible.svr, 0)} dyn*s/cm5) sustentando PAM.`
        : `SVR em queda (${fmt(currentState.visible.svr, 0)} dyn*s/cm5) com perda de pressao de perfusao.`;
  } else if (dominantDriver === 'dCO') {
    dominantMechanism =
      dCO < 0
        ? `DC em queda para ${fmt(currentState.visible.cardiacOutput)} L/min como principal limitante.`
        : `DC em ganho para ${fmt(currentState.visible.cardiacOutput)} L/min como principal vetor de melhora.`;
  } else if (dominantDriver === 'dVR') {
    dominantMechanism =
      dVR < 0
        ? `Retorno venoso caiu (${fmt(currentState.hidden.venousReturnFlow)} L/min), reduzindo pre-carga efetiva.`
        : `Retorno venoso subiu (${fmt(currentState.hidden.venousReturnFlow)} L/min), com maior pre-carga efetiva.`;
  } else if (dominantDriver === 'dPVR') {
    dominantMechanism =
      dPVR > 0
        ? `PVR em alta (${fmt(currentState.hidden.pulmonaryResistance, 0)}) elevando pos-carga de VD.`
        : `PVR em queda (${fmt(currentState.hidden.pulmonaryResistance, 0)}) aliviando carga de VD.`;
  } else if (dominantDriver === 'dExtraction') {
    dominantMechanism =
      dExtraction < 0
        ? `Extracao tecidual caiu (${fmt(currentState.hidden.extractionEfficiency, 2)}), sugerindo disfuncao microcirculatoria.`
        : `Extracao tecidual subiu (${fmt(currentState.hidden.extractionEfficiency, 2)}), aproximando equilibrio DO2-VO2.`;
  } else if (dominantDriver === 'dShunt') {
    dominantMechanism =
      dShunt > 0
        ? `Shunt em alta (${fmt(currentState.hidden.pulmonaryShuntFraction, 2)}), piorando eficiencia de troca gasosa.`
        : `Shunt em queda (${fmt(currentState.hidden.pulmonaryShuntFraction, 2)}), com melhor eficiencia de troca gasosa.`;
  } else {
    dominantMechanism =
      dContractility < 0
        ? `Contratilidade em queda (${fmt(currentState.hidden.contractilityLV, 2)}), limitando fluxo.`
        : `Contratilidade em alta (${fmt(currentState.hidden.contractilityLV, 2)}), ampliando capacidade de bombeamento.`;
  }

  const peepRise = currentState.visible.peep - previousState.visible.peep;
  const coDrop = dCO < -0.05;
  const vrDrop = dVR < -0.03;
  const shuntDrop = dShunt < -0.003;

  if (peepRise > 0.2 && shuntDrop && (coDrop || vrDrop)) {
    dominantMechanism =
      `PEEP ${fmt(currentState.visible.peep, 0)} reduziu shunt, mas elevou RAP com queda de retorno venoso/DC.`;
  } else if (dSVR > 70 && dCO < -0.08) {
    dominantMechanism =
      'SVR subiu com queda de DC: padrao de pos-carga excessiva.';
  } else if (dPVR > 20 && currentState.visible.pao2 < 75) {
    dominantMechanism =
      'Hipoxemia com PVR em alta comprometeu acoplamento VD-VE.';
  } else if (mapTrend.slopePerMin < -2.2 && dExtraction < -0.01) {
    dominantMechanism =
      'Queda de macroperfusao com piora de extracao tecidual no mesmo intervalo.';
  }

  return {
    dominantMechanism,
    drivers: {
      dSVR,
      dPVR,
      dVR,
      dContractility,
      dShunt
    }
  };
};

const buildTrendSummary = (
  mapTrend: TrendMetric,
  coTrend: TrendMetric,
  lactateTrend: TrendMetric,
  do2Trend: TrendMetric,
  svrTrend: TrendMetric
): string => {
  const mapDir = trendDirection(mapTrend, 1.5);
  const coDir = trendDirection(coTrend, 0.12);
  const lactDir = trendDirection(lactateTrend, 0.035);
  const do2Dir = trendDirection(do2Trend, 15);
  const svrDir = trendDirection(svrTrend, 45);

  const mapPart =
    mapDir === 'up'
      ? `PAM ${fmt(mapTrend.slopePerMin, 1)} mmHg/min`
      : mapDir === 'down'
      ? `PAM ${fmt(mapTrend.slopePerMin, 1)} mmHg/min`
      : `PAM estavel (${fmt(mapTrend.end, 0)} mmHg)`;

  const coPart =
    coDir === 'up'
      ? `DC +${fmt(Math.abs(coTrend.slopePerMin), 2)} L/min/min`
      : coDir === 'down'
      ? `DC -${fmt(Math.abs(coTrend.slopePerMin), 2)} L/min/min`
      : `DC estavel (${fmt(coTrend.end)} L/min)`;

  const lactPart =
    lactDir === 'up'
      ? `Lactato +${fmt(Math.abs(lactateTrend.slopePerMin), 2)} mmol/L/min`
      : lactDir === 'down'
      ? `Lactato -${fmt(Math.abs(lactateTrend.slopePerMin), 2)} mmol/L/min`
      : `Lactato estavel (${fmt(lactateTrend.end)} mmol/L)`;

  const do2Part =
    do2Dir === 'up'
      ? `DO2 +${fmt(Math.abs(do2Trend.slopePerMin), 1)}/min`
      : do2Dir === 'down'
      ? `DO2 -${fmt(Math.abs(do2Trend.slopePerMin), 1)}/min`
      : `DO2 estavel (${fmt(do2Trend.end, 0)})`;

  let couplingPart = 'CO/SVR sem desacoplamento.';
  if (svrDir === 'up' && coDir === 'down') {
    couplingPart = 'CO/SVR desacoplado (SVR sobe, DC cai).';
  } else if (svrDir === 'down' && coDir === 'down') {
    couplingPart = 'CO e SVR em queda conjunta.';
  } else if (svrDir === 'up' && coDir === 'up') {
    couplingPart = 'SVR e CO em subida conjunta.';
  }

  return `${mapPart}; ${coPart}; ${lactPart}; ${do2Part}; ${couplingPart}`;
};

const buildPerfusionSummary = (
  currentState: PatientState,
  lactateTrend: TrendMetric,
  vo2Trend: TrendMetric
): string => {
  const do2 = currentState.visible.do2;
  const vo2 = currentState.visible.vo2;
  const lactate = currentState.visible.lactate;
  const ratio = do2 / Math.max(currentState.hidden.criticalDo2, 80);
  const supplyTag =
    ratio < 1.05 || currentState.hidden.supplyDependencyIndex > 0.55
      ? 'supply dependency ativa'
      : ratio < 1.2 || currentState.hidden.supplyDependencyIndex > 0.4
      ? 'supply dependency inicial'
      : 'sem sinal forte de supply dependency';

  const lactDir = trendDirection(lactateTrend, 0.035);
  const vo2Dir = trendDirection(vo2Trend, 4);
  const lactPart =
    lactDir === 'up'
      ? `lactato em subida (${fmt(lactate)} mmol/L)`
      : lactDir === 'down'
      ? `lactato em queda (${fmt(lactate)} mmol/L)`
      : `lactato estavel (${fmt(lactate)} mmol/L)`;
  const vo2Part =
    vo2Dir === 'down'
      ? `VO2 em queda (${fmt(vo2, 0)} mL/min)`
      : vo2Dir === 'up'
      ? `VO2 em alta (${fmt(vo2, 0)} mL/min)`
      : `VO2 estavel (${fmt(vo2, 0)} mL/min)`;

  return `DO2 ${fmt(do2, 0)} (critico ${fmt(currentState.hidden.criticalDo2, 0)}); ${vo2Part}; ${lactPart}; ${supplyTag}.`;
};

const buildClinicalImplication = (
  previousState: PatientState,
  currentState: PatientState,
  caseProfile: CaseProfile,
  windowPoints: TrendPoint[],
  classification: ClassificationResult,
  mapTrend: TrendMetric,
  coTrend: TrendMetric,
  lactateTrend: TrendMetric,
  do2Trend: TrendMetric,
  vo2Trend: TrendMetric
): string => {
  const implications: string[] = [];

  const severeShock = currentState.visible.map < 50 && currentState.visible.cardiacOutput < 2.5;
  if (severeShock) {
    implications.push('Choque profundo. PAM <50 com DC <2.5 L/min.');
  }

  const do2ToCritical = currentState.visible.do2 / Math.max(currentState.hidden.criticalDo2, 80);
  const supplyDependencyActive =
    (do2ToCritical < 1.12 || currentState.hidden.supplyDependencyIndex > 0.45) &&
    vo2Trend.slopePerMin < -4;

  if (supplyDependencyActive) {
    implications.push('Inicio de supply dependency: DO2 aproximando do critico com VO2 em queda.');
  }

  const sustainedLactateRise = hasSustainedRise(windowPoints, (point) => point.lactate, 0.18, 0.01);
  if (sustainedLactateRise || lactateTrend.slopePerMin > 0.06) {
    implications.push('Lactato em subida continua: hipoperfusao sustentada em curso.');
  }

  const dSVR = currentState.visible.svr - previousState.visible.svr;
  const dCO = currentState.visible.cardiacOutput - previousState.visible.cardiacOutput;
  if (dSVR > 70 && dCO < -0.08) {
    implications.push('SVR subiu enquanto DC caiu: pos-carga excessiva.');
  }

  const peepRise = currentState.visible.peep - previousState.visible.peep;
  const dShunt =
    currentState.hidden.pulmonaryShuntFraction - previousState.hidden.pulmonaryShuntFraction;
  const dVR = currentState.hidden.venousReturnFlow - previousState.hidden.venousReturnFlow;

  if (peepRise > 0.2 && dShunt < -0.003 && dVR < -0.03) {
    implications.push('PEEP reduziu shunt, com custo hemodinamico por queda de retorno venoso.');
  }

  if (caseProfile === 'sepsis_advanced') {
    if (currentState.visible.map > previousState.visible.map && lactateTrend.slopePerMin >= 0.02) {
      implications.push('Sepse avancada: PAM melhora sem reversao metabolica (dissociacao DO2-VO2).');
    }
  } else if (caseProfile === 'hypovolemic_hemorrhagic') {
    if (currentState.visible.gedi < 620 && currentState.hidden.rightAtrialPressure < 8) {
      implications.push('Pre-carga segue baixa; reposicao de volume/hemacias ainda e eixo principal.');
    }
  } else if (caseProfile === 'eap_cardiogenic' || caseProfile === 'eap_low_output') {
    if (currentState.visible.evlw > previousState.visible.evlw + 0.12) {
      implications.push('Congestao hidrostatica em progressao (EVLW em alta).');
    }
  } else if (caseProfile === 'tep_obstructive') {
    if (currentState.hidden.pulmonaryResistance > 500 && currentState.hidden.rightAtrialPressure > 12) {
      implications.push('Componente obstrutivo dominante com sobrecarga de VD.');
    }
  }

  const worseningScore =
    (trendDirection(mapTrend, 1.5) === 'down' ? 1 : 0) +
    (trendDirection(coTrend, 0.12) === 'down' ? 1 : 0) +
    (trendDirection(lactateTrend, 0.035) === 'up' ? 1 : 0) +
    (trendDirection(do2Trend, 15) === 'down' ? 1 : 0);
  const improvingScore =
    (trendDirection(mapTrend, 1.5) === 'up' ? 1 : 0) +
    (trendDirection(coTrend, 0.12) === 'up' ? 1 : 0) +
    (trendDirection(lactateTrend, 0.035) === 'down' ? 1 : 0) +
    (trendDirection(do2Trend, 15) === 'up' ? 1 : 0);

  if (implications.length === 0) {
    if (worseningScore >= 2) {
      implications.push(`Tendencia de piora em ${classification.stateLabel.toLowerCase()}.`);
    } else if (improvingScore >= 3) {
      implications.push('Tendencia de melhora parcial de perfusao.');
    } else {
      implications.push('Estado ainda instavel; mecanismo dominante mantido.');
    }
  }

  return implications.slice(0, 3).join(' ');
};

export interface ClinicalFeedbackResult {
  observableChange: string;
  dominantMechanism: string;
  clinicalImplication: string;
  hemodynamicState: string;
  trendSummary: string;
  message: string;
  drivers: {
    dSVR: number;
    dPVR: number;
    dVR: number;
    dContractility: number;
    dShunt: number;
  };
}

export const generateClinicalFeedback = (
  previousState: PatientState,
  currentState: PatientState,
  caseProfile: CaseProfile,
  history: TrendPoint[] = []
): ClinicalFeedbackResult => {
  const windowPoints = buildWindow(previousState, currentState, history);

  const mapTrend = buildTrend(windowPoints, (point) => point.map);
  const coTrend = buildTrend(windowPoints, (point) => point.cardiacOutput);
  const lactateTrend = buildTrend(windowPoints, (point) => point.lactate);
  const do2Trend = buildTrend(windowPoints, (point) => point.do2);
  const vo2Trend = buildTrend(windowPoints, (point) => point.vo2);
  const svrTrend = buildTrend(windowPoints, (point) => point.svr);

  const classification = classifyState(currentState, caseProfile);
  const mechanismResult = buildDominantMechanism(
    previousState,
    currentState,
    mapTrend,
    coTrend,
    svrTrend
  );

  const observableChange = `PAM ${fmt(previousState.visible.map, 0)}->${fmt(currentState.visible.map, 0)} mmHg; DC ${fmt(previousState.visible.cardiacOutput)}->${fmt(currentState.visible.cardiacOutput)} L/min; Lactato ${fmt(previousState.visible.lactate)}->${fmt(currentState.visible.lactate)} mmol/L; DO2 ${fmt(previousState.visible.do2, 0)}->${fmt(currentState.visible.do2, 0)} mL O2/min.`;

  const hemodynamicState = `${classification.stateLabel}; ${classification.severityLabel}.`;
  const trendSummary = buildTrendSummary(mapTrend, coTrend, lactateTrend, do2Trend, svrTrend);
  const perfusionSummary = buildPerfusionSummary(currentState, lactateTrend, vo2Trend);
  const clinicalImplication = buildClinicalImplication(
    previousState,
    currentState,
    caseProfile,
    windowPoints,
    classification,
    mapTrend,
    coTrend,
    lactateTrend,
    do2Trend,
    vo2Trend
  );

  const message = [
    `ESTADO HEMODINAMICO: ${hemodynamicState} PAM ${fmt(currentState.visible.map, 0)} mmHg; DC ${fmt(currentState.visible.cardiacOutput)} L/min.`,
    `MECANISMO DOMINANTE: ${mechanismResult.dominantMechanism}`,
    `PERFUSAO TECIDUAL: ${perfusionSummary}`,
    `IMPLICACAO CLINICA: ${clinicalImplication}`
  ].join('\n');

  return {
    observableChange,
    dominantMechanism: mechanismResult.dominantMechanism,
    clinicalImplication,
    hemodynamicState,
    trendSummary,
    message,
    drivers: mechanismResult.drivers
  };
};

export const generateFeedback = (
  before: PatientState,
  after: PatientState,
  caseProfile: CaseProfile,
  history: TrendPoint[] = []
): ClinicalFeedbackResult => {
  return generateClinicalFeedback(before, after, caseProfile, history);
};
