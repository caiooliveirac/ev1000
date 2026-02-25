import { Intervention, PatientState } from '@/engine/types';

export interface TrendPoint {
  timeSec: number;
  map: number;
  cardiacOutput: number;
  hr?: number;
  bsa?: number;
  svr: number;
  cvp?: number;
  svv?: number;
  gedi?: number;
  itbv?: number;
  sao2?: number;
  peep?: number;
  pvr?: number;
  svo2: number;
  lactate: number;
  do2: number;
  vo2: number;
  evlw: number;
  pvpi: number;
  hb: number;
  pao2: number;
  paco2: number;
  ph: number;
  hco3: number;
}

export type GoalLevel = 'on_target' | 'watch' | 'off_target';

export interface GoalStatus {
  id: string;
  label: string;
  target: string;
  current: string;
  level: GoalLevel;
  reason: string;
}

export interface TimelineEntry {
  id: string;
  timeSec: number;
  kind: 'intervention' | 'adverse' | 'system';
  message: string;
}

export interface SimulationState {
  patient: PatientState;
  history: TrendPoint[];
  feedback: string;
  dominantMechanism: string;
  lastFeedbackAtSec: number;
  debugDrivers: {
    dSVR: number;
    dPVR: number;
    dVR: number;
    dContractility: number;
    dShunt: number;
  };
  goals: GoalStatus[];
  timeline: TimelineEntry[];
}

export interface TickResult {
  simulation: SimulationState;
  intervention?: Intervention;
}
