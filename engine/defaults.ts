/**
 * Default values, normalization helpers, and baseline constants used
 * throughout the engine calibration and initialisation pipeline.
 */
import {
  EngineEvent,
  HiddenPhysiology,
  PatientState,
  ProfileParameters,
  VisibleState
} from '@/engine/types';

// ── Baseline visible state (healthy adult reference) ──────────────────
export const baselineVisible: VisibleState = {
  hr: 85,
  bsa: 1.9,
  strokeVolume: 70,
  cardiacOutput: 5.9,
  cardiacIndex: 3.1,
  svr: 900,
  indexedSVR: 1710,
  map: 75,
  cvp: 8,
  svv: 12,
  gedi: 700,
  itbv: 875,
  evlw: 7,
  pvpi: 1.5,
  svo2: 68,
  do2: 980,
  vo2: 230,
  hb: 12,
  lactate: 1.5,
  sao2: 97,
  spo2: 97,
  pao2: 90,
  paco2: 38,
  temperature: 37,
  ph: 7.4,
  hco3: 24,
  be: 0,
  fio2: 0.45,
  peep: 8,
  vt: 460
};

// ── Default profile parameters ────────────────────────────────────────
export const defaultProfileParameters: ProfileParameters = {
  contractilityBaseline: 1,
  vascularToneBaseline: 1,
  pulmonaryHydrostaticSensitivity: 1,
  leakBaseline: 1,
  betaSensitivity: 1,
  ventricularCompliance: 1,
  rightLeftCoupling: 1,

  pvrFloor: 0,
  starlingMid: 640,
  starlingSlope: 85,
  preloadResponsivenessBase: 0.48,
  preloadResponsivenessMin: 0.12,
  preloadResponsivenessMax: 0.95,
  plateauScale: 1,
  volumeRecruitmentGain: 0,
  mapDecouplingBias: 0,

  dobutamineContractilityGain: 0.25,
  dobutamineAfterloadRelief: 0,
  dobutamineFlowSupportBase: 0,
  dobutamineFlowSupportLowOutputGain: 0,

  norepiEmaxOffset: 0,
  norepiEc50Multiplier: 1,
  pressorGainScale: 0,
  dobutamineSvrOffset: 0.12,

  preloadBackpressureScale: 4.5,
  preloadCongestionToGedi: 0,
  preloadArdsPenaltyScale: 45,

  lvedpBase: 12,
  lvedpContractilityWeight: 0.6,
  lvedpAfterloadWeight: 0.3,
  lvedpVolumeWeight: 0.2,
  lvedpMin: 6,
  lvedpMax: 34,

  rightPressureBase: 5.8,
  rightPressureLvedpWeight: 0,
  rightPressurePvrWeight: 0.0015,
  rightPressureEvlwWeight: 0.02,

  gediBase: 700,
  gediBloodVolumeWeight: 0.08,
  gediLvedpWeight: 0,
  gediFluidWeight: 0.01,
  gediTargetMin: 520,
  gediTargetMax: 1450,

  evlwLeakWeight: 5.2,
  evlwHydroWeight: 1.1,
  evlwHydroLvedpDivisor: 7,
  evlwHydroCvpDivisor: 7,

  volumeResponseBloodVolumeScale: 300,
  volumeResponseBloodVolumeGain: 0.16,
  volumeResponsePmsClamp: 1.8,
  volumeResponsePmsGain: 0.12,
  volumeResponseCongestionScale: 260,
  volumeResponseCongestionGain: 0.18,
  volumeResponseEvlwGain: 0.22,
  volumeResponseMaxPositive: 1,
  volumeResponseMaxNegative: 1.2,
  volumeResponseTau: 48
};

// ── Normalization helpers ─────────────────────────────────────────────

export const normalizeProfileParameters = (
  parameters?: Partial<ProfileParameters>
): ProfileParameters => {
  return {
    ...defaultProfileParameters,
    ...(parameters || {})
  };
};

export const normalizeHidden = (hidden: HiddenPhysiology): HiddenPhysiology => {
  const safeBloodVolume = hidden.bloodVolume || 5000;
  const safeHemoglobin = hidden.hemoglobin || 12;
  return {
    ...hidden,
    weightKg: hidden.weightKg || 75,
    basalSVR: hidden.basalSVR || 900,
    basalPVR: hidden.basalPVR || 220,
    venousResistanceBase: hidden.venousResistanceBase || 1.2,
    pulmonaryComplianceBase: hidden.pulmonaryComplianceBase || 45,
    ardsSeverity: hidden.ardsSeverity || 0,
    atelectasis: hidden.atelectasis || 0.1,
    functionalShunt: hidden.functionalShunt || 0.06,
    rightAtrialPressure: hidden.rightAtrialPressure || 8,
    leftAtrialPressure: hidden.leftAtrialPressure || 10,
    pulmonaryArteryPressure: hidden.pulmonaryArteryPressure || 20,
    meanSystemicFillingPressure: hidden.meanSystemicFillingPressure || 11,
    venousReturnFlow: hidden.venousReturnFlow || 5,
    leftVentricularPreload: hidden.leftVentricularPreload || 700,
    pulmonaryShuntFraction: hidden.pulmonaryShuntFraction || 0.2,
    supplyDependencyIndex: hidden.supplyDependencyIndex || 0.2,
    drivingPressure: hidden.drivingPressure || 12,
    pulmonaryComplianceDynamic: hidden.pulmonaryComplianceDynamic || hidden.pulmonaryComplianceBase || 45,
    recentVolumeLoad: hidden.recentVolumeLoad || 0,
    volumeEffectSite: hidden.volumeEffectSite || 0,
    volumeCoOffset: hidden.volumeCoOffset || 0,
    volumeChallengeReferenceCo: hidden.volumeChallengeReferenceCo || 0,
    volumeChallengeActive: hidden.volumeChallengeActive || false,
    equilibriumCO: hidden.equilibriumCO || 0,
    equilibriumGEDI: hidden.equilibriumGEDI || 0,
    equilibriumSVR: hidden.equilibriumSVR || 0,
    equilibriumBloodVolume: hidden.equilibriumBloodVolume || 0,
    equilibriumStarlingProduct: hidden.equilibriumStarlingProduct || 0,
    refPmsTarget: -1,
    refVRRaw: -1,
    refRVRaw: -1,
    refLVRaw: -1,
    rbcMass: hidden.rbcMass || (safeHemoglobin * safeBloodVolume) / 100,
    dominantLimiter: hidden.dominantLimiter || 'mixed',
    limiterLog: hidden.limiterLog || [],
    clampLog: hidden.clampLog || [],
    lastCalibrationTick:
      typeof hidden.lastCalibrationTick === 'number' ? hidden.lastCalibrationTick : Number.NaN
  };
};

// ── Shared utility functions ──────────────────────────────────────────

export const pushEvent = (
  events: EngineEvent[],
  timeSec: number,
  kind: EngineEvent['kind'],
  message: string
): void => {
  events.push({ timeSec, kind, message });
};

export const physiologicalOffset = (state: PatientState): number => {
  return 2 + state.hidden.rightAtrialPressure * 0.35;
};

export const logClampActivation = (
  state: PatientState,
  variable: string,
  rawValue: number,
  clampedValue: number,
  min: number,
  max: number
): void => {
  if (Math.abs(rawValue - clampedValue) <= 1e-9) {
    return;
  }
  const entry = `t=${Math.round(state.timeSec)} ${variable} raw=${rawValue.toFixed(3)} clamp=[${min.toFixed(
    3
  )},${max.toFixed(3)}] -> ${clampedValue.toFixed(3)}`;
  state.hidden.clampLog.push(entry);
  if (state.hidden.clampLog.length > 120) {
    state.hidden.clampLog.splice(0, state.hidden.clampLog.length - 120);
  }
};
