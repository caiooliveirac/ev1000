import { PatientState } from '@/engine/types';
import { GoalStatus, TrendPoint } from '@/sim/types';

const formatDelta = (value: number): string => {
  const signal = value >= 0 ? '+' : '';
  return `${signal}${value.toFixed(2)}`;
};

export const evaluateGoals = (patient: PatientState, history: TrendPoint[]): GoalStatus[] => {
  const goals: GoalStatus[] = [];

  const map = patient.visible.map;
  let mapLevel: GoalStatus['level'] = 'on_target';
  if (map < 65) {
    mapLevel = map < 58 ? 'off_target' : 'watch';
  }

  const mapReason =
    map >= 65
      ? 'Perfusao macro-hemodinamica minima atingida.'
      : patient.visible.svr < 700
      ? 'Abaixo da meta por vasoplegia predominante (RVS baixa).'
      : 'Abaixo da meta por combinacao de debito e tonus vascular insuficientes.';

  goals.push({
    id: 'map',
    label: 'PAM alvo',
    target: '>= 65 mmHg',
    current: `${map.toFixed(0)} mmHg`,
    level: mapLevel,
    reason: mapReason
  });

  const last = history[history.length - 1];
  const tenMinAgo = history.find((point) => point.timeSec >= Math.max(0, patient.timeSec - 600));
  const lactateNow = patient.visible.lactate;
  const lactateThen = tenMinAgo?.lactate ?? last?.lactate ?? lactateNow;
  const lactateDelta = lactateNow - lactateThen;

  const lactateLevel: GoalStatus['level'] =
    lactateNow <= 2.2 && lactateDelta <= 0 ? 'on_target' : lactateDelta <= 0.05 ? 'watch' : 'off_target';

  goals.push({
    id: 'lactate',
    label: 'Lactato tendencia',
    target: 'queda sustentada em 10 min',
    current: `${lactateNow.toFixed(2)} mmol/L (${formatDelta(lactateDelta)})`,
    level: lactateLevel,
    reason:
      lactateLevel === 'off_target'
        ? 'Persistencia de disoxia tecidual ou extracao ineficiente.'
        : 'Tendencia compativel com melhora gradual de oferta/uso de O2.'
  });

  const supplyRatio = patient.visible.do2 / Math.max(patient.visible.vo2, 1);
  const supplyLevel: GoalStatus['level'] =
    supplyRatio >= 2.2 ? 'on_target' : supplyRatio >= 1.7 ? 'watch' : 'off_target';

  goals.push({
    id: 'supply',
    label: 'DO2/VO2',
    target: '> 2.2 (fora de supply dependency)',
    current: supplyRatio.toFixed(2),
    level: supplyLevel,
    reason:
      supplyLevel === 'off_target'
        ? 'Oferta proxima da demanda; risco de supply dependency.'
        : 'Margem de entrega de oxigenio aceitavel no momento.'
  });

  return goals;
};
