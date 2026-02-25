import { getCaseById } from '@/cases';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { EngineEvent, Intervention } from '@/engine/types';
import { generateFeedback } from '@/sim/feedback';
import { evaluateGoals } from '@/sim/goals';
import { SimulationState, TimelineEntry, TrendPoint } from '@/sim/types';

const HISTORY_LIMIT = 21600;
const TIMELINE_LIMIT = 300;
const FEEDBACK_MIN_UPDATE_SEC = 5;

const crossedBelow = (before: number, after: number, threshold: number): boolean => {
  return before >= threshold && after < threshold;
};

const hasCriticalTransition = (before: SimulationState['patient'], after: SimulationState['patient']): boolean => {
  const mapCritical = crossedBelow(before.visible.map, after.visible.map, 50);
  const coCritical = crossedBelow(before.visible.cardiacOutput, after.visible.cardiacOutput, 2.2);
  const do2Critical = crossedBelow(before.visible.do2, after.visible.do2, after.hidden.criticalDo2 * 1.02);
  const lactateAcceleration = after.visible.lactate - before.visible.lactate >= 0.12;
  const adverseEvent = after.engineEvents.some((event) => event.kind === 'adverse');
  return mapCritical || coCritical || do2Critical || lactateAcceleration || adverseEvent;
};

const toTrendPoint = (timeSec: number, visible: SimulationState['patient']['visible']): TrendPoint => {
  return {
    timeSec,
    map: visible.map,
    cardiacOutput: visible.cardiacOutput,
    hr: visible.hr,
    bsa: visible.bsa,
    svr: visible.svr,
    cvp: visible.cvp,
    svv: visible.svv,
    gedi: visible.gedi,
    itbv: visible.itbv,
    sao2: visible.sao2,
    peep: visible.peep,
    svo2: visible.svo2,
    lactate: visible.lactate,
    do2: visible.do2,
    vo2: visible.vo2,
    evlw: visible.evlw,
    pvpi: visible.pvpi,
    hb: visible.hb,
    pao2: visible.pao2,
    paco2: visible.paco2,
    ph: visible.ph,
    hco3: visible.hco3
  };
};

const toTimelineEntries = (
  events: EngineEvent[],
  currentLength: number,
  forceKind?: TimelineEntry['kind']
): TimelineEntry[] => {
  return events.map((event, index) => ({
    id: `t_${event.timeSec}_${currentLength + index + 1}`,
    timeSec: event.timeSec,
    kind: forceKind ?? (event.kind === 'adverse' ? 'adverse' : 'system'),
    message: event.message
  }));
};

export const createSimulation = (caseId: string, seed: number): SimulationState => {
  const caseData = getCaseById(caseId);
  const patient = initializeCase(caseData, seed);
  const initialPoint = toTrendPoint(0, patient.visible);
  initialPoint.pvr = patient.hidden.pulmonaryResistance;
  const history = [initialPoint];

  return {
    patient,
    history,
    feedback: caseData.expectedPatterns ?? 'Simulacao iniciada. Ajuste doses e acompanhe latencia, tendencia e metas.',
    dominantMechanism: 'Aguardando primeira evolucao temporal.',
    lastFeedbackAtSec: 0,
    debugDrivers: {
      dSVR: 0,
      dPVR: 0,
      dVR: 0,
      dContractility: 0,
      dShunt: 0
    },
    goals: evaluateGoals(patient, history),
    timeline: [
      {
        id: 't_0_1',
        timeSec: 0,
        kind: 'system',
        message: 'Caso iniciado. Motor em tempo real com progressao autonoma de doenca.'
      }
    ]
  };
};

export const tickSimulation = (current: SimulationState, dt: number): SimulationState => {
  const before = current.patient;
  const after = step(before, dt);

  const trendPoint = toTrendPoint(after.timeSec, after.visible);
  trendPoint.pvr = after.hidden.pulmonaryResistance;
  const history = [...current.history, trendPoint].slice(-HISTORY_LIMIT);

  const newTimelineEntries = toTimelineEntries(after.engineEvents, current.timeline.length);
  const timeline = [...current.timeline, ...newTimelineEntries].slice(-TIMELINE_LIMIT);

  const shouldRefreshFeedback =
    after.timeSec - current.lastFeedbackAtSec >= FEEDBACK_MIN_UPDATE_SEC || hasCriticalTransition(before, after);

  let feedback = current.feedback;
  let dominantMechanism = current.dominantMechanism;
  let debugDrivers = current.debugDrivers;
  let lastFeedbackAtSec = current.lastFeedbackAtSec;

  if (shouldRefreshFeedback) {
    const caseProfile = getCaseById(after.caseId).caseProfile;
    const feedbackResult = generateFeedback(before, after, caseProfile, current.history);
    feedback = feedbackResult.message;
    dominantMechanism = feedbackResult.dominantMechanism;
    debugDrivers = feedbackResult.drivers;
    lastFeedbackAtSec = after.timeSec;
  }

  return {
    patient: after,
    history,
    feedback,
    dominantMechanism,
    lastFeedbackAtSec,
    debugDrivers,
    goals: evaluateGoals(after, history),
    timeline
  };
};

export const runIntervention = (
  current: SimulationState,
  intervention: Intervention
): SimulationState => {
  const before = current.patient;
  const updatedPatient = applyIntervention(current.patient, intervention);
  const caseProfile = getCaseById(updatedPatient.caseId).caseProfile;
  const feedbackResult = generateFeedback(before, updatedPatient, caseProfile, current.history);
  const entries = toTimelineEntries(updatedPatient.engineEvents, current.timeline.length, 'intervention');
  const timeline = [...current.timeline, ...entries].slice(-TIMELINE_LIMIT);

  return {
    ...current,
    patient: updatedPatient,
    feedback: feedbackResult.message,
    dominantMechanism: feedbackResult.dominantMechanism,
    lastFeedbackAtSec: updatedPatient.timeSec,
    debugDrivers: feedbackResult.drivers,
    timeline,
    goals: evaluateGoals(updatedPatient, current.history)
  };
};
