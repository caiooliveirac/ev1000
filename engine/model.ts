import { createEffectFromIntervention } from '@/engine/effects';
import { clamp, nextMulberry32, sigmoid } from '@/engine/math';
import { runCoupledPass, step as coupledStep } from '@/engine/step';
import {
  CaseData,
  EngineEvent,
  HiddenPhysiology,
  Intervention,
  PatientState,
  ProfileParameters,
  VisibleState
} from '@/engine/types';

const baselineVisible: VisibleState = {
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

const pushEvent = (events: EngineEvent[], timeSec: number, kind: EngineEvent['kind'], message: string): void => {
  events.push({ timeSec, kind, message });
};

const pickOnset = (rngState: number, minSec: number, maxSec: number): { onset: number; rngState: number } => {
  const random = nextMulberry32(rngState);
  const onset = Math.round(minSec + random.value * (maxSec - minSec));
  return { onset, rngState: random.state };
};

const normalizeHidden = (hidden: HiddenPhysiology): HiddenPhysiology => {
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
    rbcMass: hidden.rbcMass || (safeHemoglobin * safeBloodVolume) / 100,
    dominantLimiter: hidden.dominantLimiter || 'mixed',
    limiterLog: hidden.limiterLog || [],
    clampLog: hidden.clampLog || [],
    lastCalibrationTick:
      typeof hidden.lastCalibrationTick === 'number' ? hidden.lastCalibrationTick : Number.NaN
  };
};

const defaultProfileParameters: ProfileParameters = {
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

const normalizeProfileParameters = (
  parameters?: Partial<ProfileParameters>
): ProfileParameters => {
  return {
    ...defaultProfileParameters,
    ...(parameters || {})
  };
};

const physiologicalOffset = (state: PatientState): number => {
  return 2 + state.hidden.rightAtrialPressure * 0.35;
};

const logClampActivation = (
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

const updateDominantLimiterLog = (state: PatientState): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const contractilityEffective =
    hidden.contractilityLV *
    (1 - hidden.septicCardiomyopathy * 0.18) *
    (1 + hidden.dobutamineDrive * hidden.catecholamineSensitivity * 0.2);

  const preloadScore = clamp((650 - visible.gedi) / 260 + (8 - hidden.meanSystemicFillingPressure) / 6, 0, 2.5);
  const afterloadScore = clamp((visible.svr - hidden.basalSVR) / Math.max(hidden.basalSVR, 300), 0, 2.5);
  const contractilityScore = clamp((0.78 - contractilityEffective) / 0.45, 0, 2.5);
  const vrScore = clamp(
    (3.4 - hidden.venousReturnFlow) / 2.2 + (hidden.rightAtrialPressure - hidden.meanSystemicFillingPressure + 1.5) / 6,
    0,
    2.5
  );

  const scores = [
    { key: 'preload' as const, value: preloadScore },
    { key: 'afterload' as const, value: afterloadScore },
    { key: 'contractility' as const, value: contractilityScore },
    { key: 'vr' as const, value: vrScore }
  ].sort((a, b) => b.value - a.value);

  const top = scores[0];
  const second = scores[1];
  hidden.dominantLimiter = top.value - second.value < 0.08 ? 'mixed' : top.key;

  hidden.limiterLog.push({
    timeSec: state.timeSec,
    dominant: hidden.dominantLimiter,
    preload: preloadScore,
    afterload: afterloadScore,
    contractility: contractilityScore,
    vr: vrScore
  });
  if (hidden.limiterLog.length > 900) {
    hidden.limiterLog.splice(0, hidden.limiterLog.length - 900);
  }
};

const stabilizeMapDrop = (
  previousState: PatientState,
  mapTarget: number,
  co: number,
  svr: number
): number => {
  const prevMap = previousState.visible.map;
  const coRel = Math.abs((co - previousState.visible.cardiacOutput) / Math.max(previousState.visible.cardiacOutput, 0.1));
  const svrRel = Math.abs((svr - previousState.visible.svr) / Math.max(previousState.visible.svr, 1));

  const allowedDrop = 2 + 58 * Math.max(coRel, svrRel);
  if (mapTarget < prevMap - allowedDrop) {
    return prevMap - allowedDrop;
  }
  return mapTarget;
};

const calibratePvrAndVdVeCoupling = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;

  const peepPvrScale = clamp(hidden.basalPVR / 500, 0.7, 2.2);
  const peepComponent = Math.max(0, visible.peep - 8) * 16 * peepPvrScale;
  const hypoxiaComponent = Math.max(0, 80 - visible.pao2) * 2.8;
  const acidosisComponent = Math.max(0, 7.35 - visible.ph) * 220;
  const ardsComponent = hidden.ardsSeverity * 140;

  let pvrTarget = hidden.basalPVR + peepComponent + hypoxiaComponent + acidosisComponent + ardsComponent;
  pvrTarget = Math.max(pvrTarget, Math.max(hidden.basalPVR, profile.pvrFloor));

  hidden.pulmonaryResistance += (pvrTarget - hidden.pulmonaryResistance) * clamp(dt / 7, 0.06, 0.3);
  hidden.pulmonaryResistance = clamp(hidden.pulmonaryResistance, 80, 2600);

  const pvrBurden = clamp(
    (hidden.pulmonaryResistance - hidden.basalPVR) / Math.max(hidden.basalPVR, 100),
    0,
    2.4
  );

  const preloadDriver = clamp(
    (hidden.leftVentricularPreload || visible.gedi) * 0.6 +
      visible.gedi * 0.4 +
      (hidden.venousReturnFlow - 5) * 60 +
      (hidden.meanSystemicFillingPressure - 10) * 24 +
      (hidden.bloodVolume - 5000) * 0.09,
    260,
    1600
  );

  const obstructiveBaseline = clamp((hidden.basalPVR - 250) / 700, 0, 1.4);
  const pvrCouplingScale = 0.05 + 0.3 * obstructiveBaseline + 0.12 * pvrBurden;
  const couplingMin = clamp(0.55 - 0.18 * obstructiveBaseline - 0.1 * pvrBurden, 0.22, 0.55);
  const lvPreloadTarget = clamp(
    preloadDriver * clamp(1 - pvrCouplingScale * pvrBurden * profile.rightLeftCoupling, couplingMin, 1.05),
    260,
    1600
  );
  const lvPreloadTau = lvPreloadTarget > hidden.leftVentricularPreload ? 10 : 34;
  hidden.leftVentricularPreload +=
    (lvPreloadTarget - hidden.leftVentricularPreload) * clamp(dt / lvPreloadTau, 0.03, 0.22);
  hidden.leftVentricularPreload = clamp(hidden.leftVentricularPreload, 260, 1600);

  const gediTarget = clamp(hidden.leftVentricularPreload * (1 - 0.005 * pvrBurden), 280, 1600);
  const gediTauCoupling = gediTarget > visible.gedi ? 12 : 36;
  visible.gedi += (gediTarget - visible.gedi) * clamp(dt / gediTauCoupling, 0.025, 0.2);
  visible.gedi = clamp(visible.gedi, 280, 1600);
};

const calibratePreloadFromVolume = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;

  // Backpressure term is represented by RAP; avoid subtracting RAP and PEEP simultaneously.
  const intrathoracicBackpressure =
    Math.max(0, hidden.rightAtrialPressure - 7) * profile.preloadBackpressureScale;
  const congestionVolumeLoad =
    Math.max(0, hidden.leftAtrialPressure - 14) * profile.preloadCongestionToGedi +
    Math.max(0, hidden.fluidOverload) * profile.gediFluidWeight;
  const bloodVolumeContribution =
    (sigmoid(hidden.bloodVolume, 5000, 280) - 0.5) * profile.volumeResponseBloodVolumeScale;
  const venousReturnContribution =
    (sigmoid(hidden.venousReturnFlow, 4.8, 1.45) - 0.5) * (95 + profile.volumeResponsePmsGain * 120);
  const pmsContribution =
    (sigmoid(hidden.meanSystemicFillingPressure, 10.5, 1.6) - 0.5) * (70 + profile.volumeResponsePmsClamp * 45);
  const leakAttenuation = clamp(1 - hidden.capillaryLeak * 0.22 - hidden.systemicInflammation * 0.05, 0.45, 1);
  const gediFromVolume = clamp(
    670 +
      bloodVolumeContribution * leakAttenuation +
      venousReturnContribution * leakAttenuation +
      pmsContribution * (0.75 + 0.25 * leakAttenuation) -
      intrathoracicBackpressure -
      hidden.ardsSeverity * profile.preloadArdsPenaltyScale +
      congestionVolumeLoad,
    300,
    1500
  );

  const tauVolumeSec = 26;
  const tauPreloadSec = 22;

  const volumeDrivenPreloadTarget = clamp(
    gediFromVolume * 0.64 + hidden.leftVentricularPreload * 0.36,
    300,
    1600
  );

  const gediTauVolume = volumeDrivenPreloadTarget > visible.gedi ? tauVolumeSec : tauVolumeSec + 24;
  visible.gedi += (volumeDrivenPreloadTarget - visible.gedi) * clamp(dt / gediTauVolume, 0.006, 0.08);
  visible.gedi = clamp(visible.gedi, 300, 1600);
  hidden.leftVentricularPreload +=
    (volumeDrivenPreloadTarget - hidden.leftVentricularPreload) *
    clamp(dt / (volumeDrivenPreloadTarget > hidden.leftVentricularPreload ? tauPreloadSec : tauPreloadSec + 22), 0.006, 0.09);
};

const calibrateFrankStarling = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;

  const gedi = 0.65 * visible.gedi + 0.35 * hidden.leftVentricularPreload;
  const starlingCurve = sigmoid(gedi, profile.starlingMid, profile.starlingSlope);
  const plateau = clamp(
    clamp(1 - Math.max(0, gedi - 960) / 760, 0.35, 1.05) * profile.plateauScale,
    0.3,
    1.15
  );

  const hypoSignal =
    clamp((700 - gedi) / 250, 0, 1) *
    clamp((10 - hidden.leftAtrialPressure) / 6, 0, 1) *
    clamp((10 - visible.evlw) / 4, 0, 1);
  const cardioSignal =
    clamp((hidden.leftAtrialPressure - 14) / 8, 0, 1) +
    clamp((0.65 - hidden.contractilityLV) / 0.35, 0, 1) +
    clamp((visible.evlw - 10) / 7, 0, 1);

  const sepsisSignal = clamp((hidden.systemicInflammation - 0.8) / 1.5, 0, 1);

  const preloadResponsiveness = clamp(
    profile.preloadResponsivenessBase + 0.58 * hypoSignal - 0.34 * cardioSignal + 0.08 * sepsisSignal,
    profile.preloadResponsivenessMin,
    profile.preloadResponsivenessMax
  );

  const contractility = clamp(
    hidden.contractilityLV *
      profile.contractilityBaseline *
      (1 - hidden.septicCardiomyopathy * 0.18) *
      (1 +
        profile.dobutamineContractilityGain *
          hidden.dobutamineDrive *
          hidden.catecholamineSensitivity *
          profile.betaSensitivity),
    0.22,
    2.2
  );
  let afterloadPenalty = clamp(
    (visible.svr - hidden.basalSVR) / Math.max(hidden.basalSVR, 300),
    -0.25,
    0.5
  );
  const inodilatorRelief =
    hidden.dobutamineDrive *
    hidden.catecholamineSensitivity *
    profile.betaSensitivity *
    profile.dobutamineAfterloadRelief;
  afterloadPenalty = clamp(afterloadPenalty - inodilatorRelief, -0.25, 0.5);

  let starlingFlow = 1.125 + 11.2 * starlingCurve * plateau * preloadResponsiveness * contractility;
  const volumeRecruitment = sigmoid(hidden.bloodVolume, 3850, 120);
  starlingFlow += profile.volumeRecruitmentGain * volumeRecruitment;

  let coTarget = starlingFlow * (1 - Math.max(afterloadPenalty, 0) * 0.14);
  const lowFlowNeed = clamp((2.6 - visible.cardiacOutput) / 1.8, 0, 1.2);
  const inotropySignal =
    hidden.dobutamineDrive *
    hidden.catecholamineSensitivity *
    profile.betaSensitivity;
  const dobutamineSupport =
    inotropySignal *
    (profile.dobutamineFlowSupportBase + lowFlowNeed * profile.dobutamineFlowSupportLowOutputGain + 0.35);
  coTarget += dobutamineSupport;

  const congestionPenalty = clamp(
    (Math.max(0, visible.evlw - 12) / 10 +
      Math.max(0, hidden.bloodVolume - 5000) / 1500 +
      Math.max(0, hidden.leftAtrialPressure - 14) / 12) *
      clamp(cardioSignal / 2.4, 0, 1),
    0,
    0.65
  );
  const congestionRelief = clamp(inotropySignal * 0.22, 0, 0.28);
  const effectiveCongestionPenalty = clamp(congestionPenalty - congestionRelief, 0, 0.65);
  coTarget *= 1 - effectiveCongestionPenalty;

  const rawCoTarget = coTarget;
  coTarget = clamp(coTarget, 0.25, 15);
  logClampActivation(state, 'coTarget.starling', rawCoTarget, coTarget, 0.25, 15);

  visible.cardiacOutput += (coTarget - visible.cardiacOutput) * clamp(dt / 55, 0.008, 0.05);
  const rawCoVisible = visible.cardiacOutput;
  visible.cardiacOutput = clamp(visible.cardiacOutput, 0.25, 16);
  logClampActivation(state, 'cardiacOutput.starling', rawCoVisible, visible.cardiacOutput, 0.25, 16);
};

const calibrateLvedpAndRightPressure = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;

  const contractilityFailure = clamp(
    (0.62 - hidden.contractilityLV * profile.contractilityBaseline) / 0.28,
    0,
    1.8
  );
  const afterloadStress = clamp((visible.svr - hidden.basalSVR) / Math.max(hidden.basalSVR, 320), 0, 1.8);
  const compliancePenalty = 1 / Math.max(profile.ventricularCompliance, 0.35);
  const volumeStress = clamp(
    (Math.max(0, hidden.bloodVolume - 5000) / 900 +
      Math.max(0, hidden.fluidOverload) / 1800 +
      Math.max(0, visible.gedi - 760) / 260) *
      compliancePenalty,
    0,
    2.4
  );

  const lvedpTarget = clamp(
    profile.lvedpBase +
      contractilityFailure * profile.lvedpContractilityWeight +
      afterloadStress * profile.lvedpAfterloadWeight +
      volumeStress * profile.lvedpVolumeWeight,
    profile.lvedpMin,
    profile.lvedpMax
  );
  hidden.leftAtrialPressure += (lvedpTarget - hidden.leftAtrialPressure) * clamp(dt / 18, 0.03, 0.2);
  hidden.leftAtrialPressure = clamp(hidden.leftAtrialPressure, profile.lvedpMin, profile.lvedpMax);

  const gediRawTarget =
    profile.gediBase +
      (hidden.bloodVolume - 5000) * profile.gediBloodVolumeWeight +
      Math.max(0, hidden.leftAtrialPressure - 14) * profile.gediLvedpWeight +
      afterloadStress * profile.gediLvedpWeight * 0.6 +
      hidden.fluidOverload * profile.gediFluidWeight;
  // Congestion floor should only protect against implausible drops under elevated filling pressures.
  // Using gediTargetMin avoids pinning non-congestive profiles to an artificial high baseline.
  const gediCongestionFloor = profile.gediTargetMin +
    Math.max(0, hidden.leftAtrialPressure - 14) * profile.gediLvedpWeight * 0.9 +
    afterloadStress * profile.gediLvedpWeight * 0.4 +
    Math.max(0, hidden.fluidOverload) * profile.gediFluidWeight * 0.7;
  const gediTarget = clamp(
    Math.max(gediRawTarget, gediCongestionFloor),
    profile.gediTargetMin,
    profile.gediTargetMax
  );
  visible.gedi += (gediTarget - visible.gedi) * clamp(dt / 20, 0.03, 0.16);
  visible.gedi = clamp(visible.gedi, 300, 1600);
  // Keep volumetric index and hidden LV preload coupled to avoid a decoupled low-flow sink.
  const preloadSyncTau = gediTarget > hidden.leftVentricularPreload ? 22 : 34;
  hidden.leftVentricularPreload +=
    (visible.gedi - hidden.leftVentricularPreload) * clamp(dt / preloadSyncTau, 0.02, 0.12);
  hidden.leftVentricularPreload = clamp(hidden.leftVentricularPreload, 260, 1600);

  const rvBackPressure = clamp(
    Math.max(0, hidden.leftAtrialPressure - 14) * profile.rightPressureLvedpWeight +
      Math.max(0, hidden.pulmonaryResistance - hidden.basalPVR) *
        profile.rightPressurePvrWeight *
        profile.rightLeftCoupling +
      Math.max(0, visible.evlw - 12) * profile.rightPressureEvlwWeight,
    0,
    10
  );
  const rapTarget = clamp(
    profile.rightPressureBase +
      rvBackPressure +
      Math.max(0, hidden.meanSystemicFillingPressure - 11) * 0.2 +
      hidden.arrhythmiaBurden,
    4,
    26
  );
  hidden.rightAtrialPressure += (rapTarget - hidden.rightAtrialPressure) * clamp(dt / 22, 0.02, 0.12);
  hidden.rightAtrialPressure = clamp(hidden.rightAtrialPressure, 2, 30);
};

const calibrateNorepiEmax = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;

  const dose = clamp(hidden.norepinephrineRate, 0, 3);
  const sens = clamp(hidden.catecholamineSensitivity * profile.betaSensitivity, 0.2, 2.4);
  const vasoplegia = clamp(hidden.systemicInflammation / 2.5 + hidden.capillaryLeak / 3.6, 0, 1.6);
  const hill = 1.55;
  const emax = clamp(0.92 + 0.98 * sens - 0.27 * vasoplegia + profile.norepiEmaxOffset, 0.4, 2.8);
  const ec50 = clamp(
    (0.1 + 0.23 * vasoplegia + (1 - sens) * 0.09) * profile.norepiEc50Multiplier,
    0.04,
    1.2
  );

  const dosePow = Math.pow(dose, hill);
  const ecPow = Math.pow(ec50, hill);
  const effect = (emax * dosePow) / Math.max(dosePow + ecPow, 1e-6);
  const pressorGain = 1 + profile.pressorGainScale * effect;

  const rawSvrTarget =
    hidden.basalSVR *
    hidden.basalTone *
    profile.vascularToneBaseline *
    pressorGain *
    (1 + 1.8 * effect + 0.95 * hidden.vasopressinDrive - profile.dobutamineSvrOffset * hidden.dobutamineDrive) /
    (1 + hidden.systemicInflammation * 0.38);
  const svrTarget = clamp(rawSvrTarget, 220, 4700);
  logClampActivation(state, 'svrTarget.norepi', rawSvrTarget, svrTarget, 220, 4700);

  const tauVasopressorSec = effect >= hidden.norepinephrineDrive ? 24 : 34;
  visible.svr += (svrTarget - visible.svr) * clamp(dt / tauVasopressorSec, 0.02, 0.14);
  const rawVisibleSvr = visible.svr;
  visible.svr = clamp(visible.svr, 220, 4700);
  logClampActivation(state, 'svr.visible', rawVisibleSvr, visible.svr, 220, 4700);

  // Keep a weak secondary afterload effect here; dominant LV-afterload coupling remains in the core model.
  const secondaryAfterload = clamp(
    (visible.svr - hidden.basalSVR * 1.55) / Math.max(hidden.basalSVR * 0.9, 220),
    0,
    1.2
  );
  if (secondaryAfterload > 0) {
    const rawCoTarget = visible.cardiacOutput * (1 - secondaryAfterload * 0.03);
    const coTarget = clamp(rawCoTarget, 0.25, 16);
    logClampActivation(state, 'coTarget.norepiSecondary', rawCoTarget, coTarget, 0.25, 16);
    visible.cardiacOutput += (coTarget - visible.cardiacOutput) * clamp(dt / 28, 0.02, 0.12);
    const rawCoVisible = visible.cardiacOutput;
    visible.cardiacOutput = clamp(visible.cardiacOutput, 0.25, 16);
    logClampActivation(state, 'cardiacOutput.norepiSecondary', rawCoVisible, visible.cardiacOutput, 0.25, 16);
  }
};

const calibrateEvlwAndCompliance = (
  state: PatientState,
  previousState: PatientState,
  dt: number
): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const deltaBloodVolume = hidden.bloodVolume - previousState.hidden.bloodVolume;

  // Short memory of recent positive volume load for EVLW hysteresis in high-leak states.
  hidden.recentVolumeLoad += Math.max(0, deltaBloodVolume) * 0.9;
  hidden.recentVolumeLoad += -hidden.recentVolumeLoad * clamp(dt / 300, 0.002, 0.04);
  hidden.recentVolumeLoad = clamp(hidden.recentVolumeLoad, 0, 2600);

  const volumeStress =
    Math.max(0, hidden.bloodVolume - 5000) / 900 + Math.max(0, hidden.fluidOverload) / 2300;
  const profile = state.profileParameters;
  const lvedpHydro = Math.max(0, hidden.leftAtrialPressure - 14);
  const hydrostatic =
    lvedpHydro / Math.max(profile.evlwHydroLvedpDivisor, 1) +
    Math.max(0, visible.cvp - 10) / Math.max(profile.evlwHydroCvpDivisor, 1) +
    Math.max(0, hidden.pulmonaryResistance - hidden.basalPVR) / 900;
  const leakWeight = profile.evlwLeakWeight * profile.leakBaseline;
  const hydroWeight = profile.evlwHydroWeight * profile.pulmonaryHydrostaticSensitivity;

  let evlwTarget = clamp(
    6 +
      hidden.capillaryLeak * leakWeight +
      volumeStress * (1.2 + hidden.capillaryLeak * 0.95) +
      hydrostatic * hydroWeight,
    4,
    36
  );

  const hydroFloor = clamp(
    6 + lvedpHydro * 0.32 * profile.pulmonaryHydrostaticSensitivity + Math.max(0, visible.cvp - 10) * 0.18,
    4,
    34
  );
  evlwTarget = Math.max(evlwTarget, hydroFloor);

  const leakStress = clamp((hidden.capillaryLeak - 0.6) / 0.9, 0, 1);
  const volumeMemoryStress = clamp(hidden.recentVolumeLoad / 850, 0, 1.2);
  const retentionBias = leakStress * volumeMemoryStress;
  if (retentionBias > 0) {
    const shortTermFloor = previousState.visible.evlw * (1 - 0.05 * (1 - retentionBias));
    const softRiseTarget = previousState.visible.evlw + 0.18 * retentionBias;
    evlwTarget = Math.max(evlwTarget, shortTermFloor, softRiseTarget);
  }

  visible.evlw += (evlwTarget - visible.evlw) * clamp(dt / 8, 0.06, 0.25);
  const rawEvlw = visible.evlw;
  visible.evlw = clamp(visible.evlw, 4, 36);
  logClampActivation(state, 'evlw.visible', rawEvlw, visible.evlw, 4, 36);

  const pvpiLeakFloor = clamp(1.05 + hidden.capillaryLeak * 0.85, 1, 4.8);
  const pvpiRawTarget = 1.1 + (hidden.capillaryLeak * 2.35) / (1 + volumeStress * 0.95);
  const pvpiTarget = clamp(Math.max(pvpiRawTarget, pvpiLeakFloor), 1, 8);
  visible.pvpi += (pvpiTarget - visible.pvpi) * clamp(dt / 8, 0.06, 0.25);
  const rawPvpi = visible.pvpi;
  visible.pvpi = clamp(visible.pvpi, 1, 8);
  logClampActivation(state, 'pvpi.visible', rawPvpi, visible.pvpi, 1, 8);

  const compliancePenalty = 1 + Math.max(0, visible.evlw - 8) * 0.11 + hidden.ardsSeverity * 0.85;
  const complianceTarget = clamp(hidden.pulmonaryComplianceBase / compliancePenalty, 8, 95);
  hidden.pulmonaryComplianceDynamic +=
    (complianceTarget - hidden.pulmonaryComplianceDynamic) * clamp(dt / 7, 0.06, 0.3);
  hidden.pulmonaryComplianceDynamic = clamp(hidden.pulmonaryComplianceDynamic, 8, 95);

  // PEEP hemodynamics as damped targets (no multiplicative per-tick collapse).
  const tauVentilatorySec = 12;
  const peepAbove = Math.max(0, visible.peep - 8);
  const stiffness = clamp((36 - hidden.pulmonaryComplianceDynamic) / 24, 0, 1.1);

  const peepRapCap = 6 * clamp(0.82 + stiffness * 0.18, 0.7, 1);
  const peepRapContribution = clamp(peepAbove * (0.12 + 0.08 * stiffness), 0, peepRapCap);
  const absoluteRvAfterload = sigmoid(hidden.pulmonaryResistance, 420, 130);
  const relativeRvAfterload = Math.max(0, hidden.pulmonaryResistance - hidden.basalPVR) * 0.0055;
  const rapBaseline = clamp(
    5.4 +
      Math.max(0, hidden.meanSystemicFillingPressure - 10) * 0.45 +
      hidden.arrhythmiaBurden * 1.5 +
      relativeRvAfterload +
      absoluteRvAfterload * hidden.rvCompliance * state.profileParameters.rightLeftCoupling * 2.8 +
      Math.max(0, hidden.leftAtrialPressure - 10) * 0.22,
    1,
    22
  );
  const rapTarget = clamp(rapBaseline + peepRapContribution, 1, 30);
  hidden.rightAtrialPressure += (rapTarget - hidden.rightAtrialPressure) * clamp(dt / tauVentilatorySec, 0.04, 0.22);
  const rawRap = hidden.rightAtrialPressure;
  hidden.rightAtrialPressure = clamp(hidden.rightAtrialPressure, 1, 30);
  logClampActivation(state, 'rightAtrialPressure.peep', rawRap, hidden.rightAtrialPressure, 1, 30);

  const venousResistance = clamp(
    hidden.venousResistanceBase / Math.max(hidden.venousCompliance, 0.45),
    0.4,
    5
  );
  const guytonVr = (hidden.meanSystemicFillingPressure - hidden.rightAtrialPressure) / Math.max(venousResistance, 0.35);
  const pvrExcess = Math.max(0, hidden.pulmonaryResistance - hidden.basalPVR);
  const basalPvrLoad = clamp(hidden.basalPVR / 600, 0.3, 2);
  const pvrBurden = clamp(pvrExcess / Math.max(hidden.basalPVR, 120), 0, 2.2);
  const peepHemodynamicScale = clamp(0.42 + 0.55 * basalPvrLoad + 0.32 * pvrBurden, 0.45, 2.2);
  const peepVrPenalty = clamp(peepAbove * (0.012 + 0.01 * stiffness) * peepHemodynamicScale, 0, 0.8);

  const obstructiveBurden = clamp((hidden.basalPVR - 320) / 700 + pvrExcess / 900, 0, 1.2);
  const gradientSupport =
    (Math.max(0, hidden.meanSystemicFillingPressure - hidden.rightAtrialPressure) / 2.4) *
    clamp(1 - 0.55 * obstructiveBurden, 0.25, 1);
  const preloadFloor = clamp(
    0.85 +
      Math.max(0, hidden.bloodVolume - 5000) / 1100 +
      Math.max(0, visible.gedi - 700) / 480 +
      gradientSupport,
    0.75,
    2.8
  );
  const vrTarget = clamp(guytonVr - peepVrPenalty, preloadFloor, 20);
  hidden.venousReturnFlow += (vrTarget - hidden.venousReturnFlow) * clamp(dt / tauVentilatorySec, 0.03, 0.18);
  const rawVr = hidden.venousReturnFlow;
  hidden.venousReturnFlow = clamp(hidden.venousReturnFlow, 0, 20);
  logClampActivation(state, 'venousReturnFlow.peep', rawVr, hidden.venousReturnFlow, 0, 20);

  const coSecondaryPenalty = clamp(
    peepAbove * (0.0025 + 0.0018 * stiffness) * clamp(0.72 + 0.42 * basalPvrLoad + 0.32 * pvrBurden, 0.6, 1.9),
    0,
    0.11
  );
  const rawCoFlowTarget = 0.72 * visible.cardiacOutput + 0.28 * hidden.venousReturnFlow;
  const coFlowTarget = clamp(rawCoFlowTarget, 0.25, 16);
  logClampActivation(state, 'coFlowTarget.peep', rawCoFlowTarget, coFlowTarget, 0.25, 16);
  const rvAfterloadBurden = clamp(
    (hidden.pulmonaryResistance - hidden.basalPVR) / Math.max(hidden.basalPVR, 120),
    0,
    2.6
  );
  const obstructiveLoad = clamp(hidden.basalPVR / 700, 0.35, 2.2);
  const peepAmplifier = sigmoid(peepAbove, 4.5, 1.8);
  const rvPenalty = clamp(
    rvAfterloadBurden * Math.pow(obstructiveLoad, 1.4) * peepAmplifier * 0.6,
    0,
    0.85
  );
  const rawCoTarget = coFlowTarget * (1 - coSecondaryPenalty - rvPenalty);
  const coTarget = clamp(rawCoTarget, 0.25, 16);
  logClampActivation(state, 'coTarget.peep', rawCoTarget, coTarget, 0.25, 16);
  visible.cardiacOutput += (coTarget - visible.cardiacOutput) * clamp(dt / 9, 0.03, 0.2);
  const rawCoVisible = visible.cardiacOutput;
  visible.cardiacOutput = clamp(visible.cardiacOutput, 0.25, 16);
  logClampActivation(state, 'cardiacOutput.peep', rawCoVisible, visible.cardiacOutput, 0.25, 16);
};

const calibrateHemoglobinFromVolume = (
  state: PatientState,
  previousState: PatientState,
  dt: number
): void => {
  const hidden = state.hidden;
  const visible = state.visible;

  hidden.rbcMass = clamp(hidden.rbcMass, 120, 1500);
  const inflammatoryAnemiaLoss = clamp(
    hidden.systemicInflammation * 0.000012 + Math.max(0, hidden.capillaryLeak - 0.9) * 0.00001,
    0,
    0.0002
  );
  hidden.rbcMass *= 1 - inflammatoryAnemiaLoss * dt;
  hidden.rbcMass = clamp(hidden.rbcMass, 120, 1500);

  const intravascularVolume = Math.max(hidden.bloodVolume, 2800);
  const leakDilutionVolume = Math.max(0, hidden.fluidOverload) * clamp(hidden.capillaryLeak * 0.04, 0, 0.16);
  const effectiveVolumeDl = (intravascularVolume + leakDilutionVolume) / 100;
  const hbTarget = clamp(hidden.rbcMass / Math.max(effectiveVolumeDl, 20), 4, 19);

  const previousVolume = Math.max(previousState.hidden.bloodVolume, 3000);
  const relativeExpansion = clamp((intravascularVolume - previousVolume) / previousVolume, -0.22, 0.35);
  const tauSec = relativeExpansion > 0.01 ? 40 : relativeExpansion < -0.01 ? 65 : 180;
  hidden.hemoglobin += (hbTarget - hidden.hemoglobin) * clamp(dt / tauSec, 0.02, 0.3);
  hidden.hemoglobin = clamp(hidden.hemoglobin, 4, 19);
  visible.hb = hidden.hemoglobin;
};

const calibrateDo2Vo2AndLactate = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const visible = state.visible;

  const sao2Fraction = clamp(visible.sao2 / 100, 0.4, 1);
  const do2 = visible.cardiacOutput * visible.hb * 1.34 * sao2Fraction * 10;
  const demand =
    hidden.oxygenDemandBase *
    (1 - hidden.sedationFactor) *
    (1 + hidden.systemicInflammation * 0.18) *
    (1 + (visible.temperature - 37) * 0.05);
  const criticalDo2 = hidden.criticalDo2 * (1 + hidden.mitochondrialDysfunction * 0.2);
  const ratio = do2 / Math.max(criticalDo2, 80);

  const plateauVo2 = demand * (1 - hidden.mitochondrialDysfunction * 0.14);
  const supplyFactor =
    ratio >= 1.02
      ? 1
      : clamp(0.15 + 0.85 * Math.pow(clamp(ratio / 1.02, 0, 1), 1.25), 0.1, 1);
  const vo2Target = clamp(plateauVo2 * supplyFactor, 40, 700);

  visible.vo2 += (vo2Target - visible.vo2) * clamp(dt / 6, 0.07, 0.3);
  visible.vo2 = clamp(visible.vo2, 40, 700);

  const supplyStress = clamp((1.02 - ratio) / 0.55, 0, 1.8);
  hidden.supplyDependencyIndex += (supplyStress - hidden.supplyDependencyIndex) * clamp(dt / 9, 0.05, 0.25);
  hidden.supplyDependencyIndex = clamp(hidden.supplyDependencyIndex, 0, 2.2);

  const lactateTarget =
    1.05 +
    hidden.supplyDependencyIndex * 5.7 +
    Math.max(0, 0.72 - hidden.extractionEfficiency) * 2.2 +
    hidden.mitochondrialDysfunction * 1.55;
  const riseTauSec = clamp(1750 - supplyStress * 760 - hidden.systemicInflammation * 130, 520, 1750);
  const perfusionRecovery = clamp((ratio - 1) / 0.8, 0, 1.2);
  const fallTauSec = clamp(3200 - perfusionRecovery * 980, 1200, 3200);
  const tau = lactateTarget > visible.lactate ? riseTauSec : fallTauSec;

  visible.lactate += (lactateTarget - visible.lactate) * clamp(dt / tau, 0.001, 0.08);
  visible.lactate = clamp(visible.lactate, 0.6, 20);

  visible.do2 = clamp(do2, 80, 2200);

  const metabolicAcidLoad =
    Math.max(0, visible.lactate - 1.2) * 1.75 +
    hidden.mitochondrialDysfunction * 0.9 +
    hidden.supplyDependencyIndex * 0.95;
  const hco3Target = clamp(24 - metabolicAcidLoad, 7, 34);
  const hco3Tau = hco3Target < visible.hco3 ? 220 : 520;
  visible.hco3 += (hco3Target - visible.hco3) * clamp(dt / hco3Tau, 0.01, 0.14);
  visible.hco3 = clamp(visible.hco3, 6, 34);

  const ventPerKg = visible.vt / Math.max(hidden.weightKg, 45);
  const ventilationCompensation = clamp((ventPerKg - 6.3) * 1.4 - (visible.peep - 10) * 0.18, -7, 7);
  const shockCo2Load =
    clamp((2.8 - visible.cardiacOutput) / 2, 0, 1.6) * 5 +
    clamp((hidden.pulmonaryResistance - hidden.basalPVR) / 900, 0, 1.6) * 2.2;
  const paco2Target = clamp(40 + shockCo2Load - ventilationCompensation, 22, 95);
  visible.paco2 += (paco2Target - visible.paco2) * clamp(dt / 75, 0.01, 0.1);
  visible.paco2 = clamp(visible.paco2, 22, 100);

  visible.ph = clamp(6.1 + Math.log10(Math.max(visible.hco3, 1) / (0.03 * visible.paco2)), 6.8, 7.6);
  visible.be = clamp((visible.hco3 - 24) + (visible.ph - 7.4) * 10, -30, 15);
};

const calibrateProfileSpecificVolumeResponse = (
  state: PatientState,
  previousState: PatientState,
  dt: number
): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;
  const deltaBloodVolume = hidden.bloodVolume - previousState.hidden.bloodVolume;
  const deltaPms = hidden.meanSystemicFillingPressure - previousState.hidden.meanSystemicFillingPressure;

  const previousVolumeEffectSite = hidden.volumeEffectSite;
  const bolusInputMl = Math.max(0, deltaBloodVolume) + Math.max(0, deltaPms) * 120;
  const bolusSignal = 1100 * (1 - Math.exp(-bolusInputMl / 750));
  const volumeInputTarget = clamp(hidden.recentVolumeLoad + bolusSignal, 0, 2600);
  const volumeInputTau = volumeInputTarget > hidden.volumeEffectSite ? 36 : 85;
  hidden.volumeEffectSite +=
    (volumeInputTarget - hidden.volumeEffectSite) * clamp(dt / volumeInputTau, 0.02, 0.2);
  hidden.volumeEffectSite = clamp(hidden.volumeEffectSite, 0, 2600);

  if (!hidden.volumeChallengeActive && previousVolumeEffectSite <= 120 && hidden.volumeEffectSite > 120) {
    hidden.volumeChallengeActive = true;
    hidden.volumeChallengeReferenceCo = visible.cardiacOutput;
  } else if (hidden.volumeChallengeActive && hidden.volumeEffectSite < 55) {
    hidden.volumeChallengeActive = false;
    hidden.volumeChallengeReferenceCo = visible.cardiacOutput;
  } else if (!hidden.volumeChallengeActive && hidden.volumeEffectSite < 40) {
    hidden.volumeChallengeReferenceCo = visible.cardiacOutput;
  }

  const svvResponsive = sigmoid(visible.svv, 12, 2.5);
  const gediResponsive = 1 - sigmoid(visible.gedi, 700, 85);
  const cvpResponsive = 1 - sigmoid(visible.cvp, 10, 1.7);
  const vrGradientResponsive =
    1 - sigmoid(hidden.rightAtrialPressure - hidden.meanSystemicFillingPressure, -1, 1.4);
  const preloadResponsiveSignal = clamp(
    0.38 * svvResponsive +
      0.3 * gediResponsive +
      0.22 * cvpResponsive +
      0.1 * vrGradientResponsive,
    0,
    1
  );

  const congestionSignal = clamp(
    0.3 * sigmoid(visible.cvp, 12, 1.7) +
      0.25 * sigmoid(visible.gedi, 860, 95) +
      0.25 * sigmoid(visible.evlw, 11.5, 1.8) +
      0.2 * sigmoid(hidden.leftAtrialPressure, 16, 2.2),
    0,
    1.6
  );
  const rvObstructionSignal = clamp(
    0.45 * sigmoid(hidden.pulmonaryResistance, 420, 130) +
      0.35 * sigmoid(hidden.pulmonaryResistance / Math.max(hidden.basalPVR, 120), 1.2, 0.22) +
      0.2 * sigmoid(hidden.rightAtrialPressure, 11.8, 1.9),
    0,
    1.8
  );

  const doseSignal = 1 - Math.exp(-hidden.volumeEffectSite / 420);
  const overloadSignal = sigmoid(hidden.volumeEffectSite, 820, 150);
  const profileSignal = clamp(
    0.42 + 0.9 * profile.preloadResponsivenessBase + 0.18 * profile.preloadResponsivenessMax,
    0.2,
    1.2
  );
  const responsiveness = clamp(
    preloadResponsiveSignal *
      profileSignal *
      (1 - 0.8 * congestionSignal) *
      (1 - 0.65 * rvObstructionSignal),
    0,
    1
  );

  const profileVolumeGain = clamp(
    0.5 + profile.volumeResponseBloodVolumeGain * 1.8 + profile.volumeResponsePmsGain * 1.4,
    0.35,
    1.6
  );
  const profileCongestionGain = clamp(
    0.45 + profile.volumeResponseCongestionGain * 0.9 + profile.volumeResponseEvlwGain * 0.7,
    0.35,
    1.8
  );
  const positiveScale = clamp(profile.volumeResponseMaxPositive, 0.4, 1.8);
  const negativeScale = clamp(profile.volumeResponseMaxNegative, 0.3, 2.6);

  const positiveOffset = clamp(
    (0.04 + 0.38 * doseSignal) * responsiveness * profileVolumeGain * positiveScale,
    0,
    0.9
  );
  const obstructionPenalty = 0.18 * rvObstructionSignal * doseSignal;
  const highDosePenalty = Math.pow(doseSignal, 2.2) * overloadSignal * 0.95;
  const negativeOffset =
    ((0.06 + 0.78 * congestionSignal + 0.52 * rvObstructionSignal) * overloadSignal +
      obstructionPenalty +
      highDosePenalty) *
    profileCongestionGain *
    negativeScale;
  const desiredVolumeOffset = clamp(positiveOffset - negativeOffset, -0.9, 0.85);

  const previousOffset = hidden.volumeCoOffset;
  const tauVolumeSec = clamp(profile.volumeResponseTau, 26, 85);
  const offsetTau = desiredVolumeOffset >= previousOffset ? tauVolumeSec : tauVolumeSec * 0.8;
  hidden.volumeCoOffset +=
    (desiredVolumeOffset - hidden.volumeCoOffset) * clamp(dt / offsetTau, 0.01, 0.12);
  hidden.volumeCoOffset = clamp(hidden.volumeCoOffset, -0.95, 0.9);

  const coOffsetDelta = hidden.volumeCoOffset - previousOffset;
  const rawCoVisible = visible.cardiacOutput + coOffsetDelta;
  visible.cardiacOutput = clamp(rawCoVisible, 0.25, 16);
  logClampActivation(state, 'cardiacOutput.volumeOffset', rawCoVisible, visible.cardiacOutput, 0.25, 16);

  // Continuous combo stress (PEEP x pressor) with damped target reduction, no hard CO clamps.
  const peepStress = sigmoid(visible.peep, 12, 2.2);
  // Use effect-site drive (not commanded rate) to preserve physiologic onset delay.
  const pressorStress = sigmoid(hidden.norepinephrineDrive, 0.45, 0.18);
  const comboStressFactor = clamp(peepStress * pressorStress, 0, 1);
  if (comboStressFactor > 0.02) {
    const preloadBuffer = clamp(
      (visible.gedi - 680) / 420 + (hidden.meanSystemicFillingPressure - 10) / 6,
      -0.45,
      0.85
    );
    const afterloadSignal = clamp(
      (visible.svr - hidden.basalSVR) / Math.max(hidden.basalSVR, 320),
      0,
      1.25
    );
    const venousLimitation = clamp(
      (hidden.rightAtrialPressure - hidden.meanSystemicFillingPressure + 2.5) / 8,
      0,
      1.4
    );
    const reductionTarget =
      comboStressFactor * (0.022 + afterloadSignal * 0.075 + venousLimitation * 0.085 - preloadBuffer * 0.09);
    const reductionFraction = clamp(reductionTarget, 0, 0.3);
    const rawCoTarget = visible.cardiacOutput * (1 - reductionFraction);
    const coTarget = clamp(rawCoTarget, 0.25, 16);
    logClampActivation(state, 'coTarget.comboStress', rawCoTarget, coTarget, 0.25, 16);
    const comboTauSec = 24;
    visible.cardiacOutput += (coTarget - visible.cardiacOutput) * clamp(dt / comboTauSec, 0.02, 0.12);
    const rawComboCo = visible.cardiacOutput;
    visible.cardiacOutput = clamp(visible.cardiacOutput, 0.25, 16);
    logClampActivation(state, 'cardiacOutput.comboStress', rawComboCo, visible.cardiacOutput, 0.25, 16);
  }

  if (hidden.volumeChallengeActive && hidden.volumeChallengeReferenceCo > 0.1) {
    const challengeDose = 1 - Math.exp(-hidden.volumeEffectSite / 460);
    const maxFractionGain = clamp(
      (0.06 + 0.24 * challengeDose) *
        (0.4 + 0.8 * responsiveness) *
        clamp(profileVolumeGain, 0.55, 1.2) *
        positiveScale,
      0.04,
      0.36
    );
    const upperBound = hidden.volumeChallengeReferenceCo * (1 + maxFractionGain);
    const lowerBound =
      hidden.volumeChallengeReferenceCo *
      clamp(1 - (0.18 * overloadSignal + 0.12 * congestionSignal) * negativeScale, 0.5, 1);

    if (visible.cardiacOutput > upperBound) {
      visible.cardiacOutput += (upperBound - visible.cardiacOutput) * clamp(dt / 14, 0.04, 0.2);
    } else if (visible.cardiacOutput < lowerBound) {
      visible.cardiacOutput += (lowerBound - visible.cardiacOutput) * clamp(dt / 18, 0.03, 0.16);
    }
    visible.cardiacOutput = clamp(visible.cardiacOutput, 0.25, 16);
  }
};

const calibrateMapAndDerived = (
  state: PatientState,
  previousState: PatientState,
  dt: number
): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;

  const decoupleBase =
    1 -
    hidden.microShunt * 0.12 -
    hidden.mitochondrialDysfunction * 0.08 -
    profile.mapDecouplingBias;
  const decoupleFactor = clamp(decoupleBase, 0.76, 1.03);

  const expectedMap =
    ((visible.cardiacOutput * visible.svr) / 80 + physiologicalOffset(state)) * decoupleFactor;

  let mapTarget = expectedMap;
  mapTarget = stabilizeMapDrop(previousState, mapTarget, visible.cardiacOutput, visible.svr);

  visible.map += (mapTarget - visible.map) * clamp(dt / 5, 0.08, 0.45);
  const rawMap = visible.map;
  visible.map = clamp(visible.map, 25, 150);
  logClampActivation(state, 'map.visible', rawMap, visible.map, 25, 150);

  visible.cvp = clamp(hidden.rightAtrialPressure, 1, 30);
  visible.strokeVolume = clamp((visible.cardiacOutput * 1000) / Math.max(visible.hr, 40), 8, 200);
  visible.cardiacIndex = visible.cardiacOutput / Math.max(visible.bsa, 1.2);
  visible.indexedSVR = visible.svr * visible.bsa;
  const volumetricProxy = clamp(
    260 +
      (hidden.bloodVolume - 3500) * (0.16 + profile.gediBloodVolumeWeight * 0.55) +
      (hidden.meanSystemicFillingPressure - 6) * 95 -
      Math.max(0, hidden.rightAtrialPressure - 10) * 8 -
      hidden.ardsSeverity * 25 +
      Math.max(0, hidden.leftAtrialPressure - 12) * profile.preloadCongestionToGedi * 0.15,
    280,
    1600
  );
  visible.gedi += (volumetricProxy - visible.gedi) * clamp(dt / 18, 0.03, 0.18);
  visible.gedi = clamp(visible.gedi, 280, 1600);
  visible.itbv = clamp(visible.gedi * 1.24, 420, 2200);
  const preloadSignal = clamp((700 - visible.gedi) / 220, -0.4, 1.8);
  const ventilatorySignal = clamp((visible.peep - 8) / 9, -0.2, 1.5);
  const congestionSignal = clamp(
    Math.max(0, visible.cvp - 10) / 6 + Math.max(0, visible.gedi - 900) / 320,
    0,
    2
  );
  const volumeReliefSignal = clamp((hidden.bloodVolume - 5000) / 550, -2.2, 2.2);
  const svvTarget =
    8 + preloadSignal * 10.5 + ventilatorySignal * 4.4 - congestionSignal * 5.8 - volumeReliefSignal * 2.2;
  const rawSvv = svvTarget;
  visible.svv = clamp(svvTarget, 2, 45);
  logClampActivation(state, 'svv.visible', rawSvv, visible.svv, 2, 45);

  const oxygenCarry = Math.max(visible.cardiacOutput * visible.hb * 1.34 * 10, 1);
  const extractionDelta = (visible.vo2 / oxygenCarry) * clamp(hidden.extractionEfficiency, 0.2, 0.98);
  visible.svo2 = clamp(
    visible.sao2 - extractionDelta * 100 + hidden.functionalShunt * 7 + hidden.mitochondrialDysfunction * 4,
    20,
    95
  );

  updateDominantLimiterLog(state);
};

const applyPhysiologyCalibration = (
  currentState: PatientState,
  previousState: PatientState,
  dt: number
): PatientState => {
  if (currentState.hidden.lastCalibrationTick === currentState.timeSec) {
    return currentState;
  }

  calibratePvrAndVdVeCoupling(currentState, dt);
  calibratePreloadFromVolume(currentState, dt);
  calibrateNorepiEmax(currentState, dt);
  calibrateFrankStarling(currentState, dt);
  calibrateLvedpAndRightPressure(currentState, dt);
  calibrateEvlwAndCompliance(currentState, previousState, dt);
  calibrateHemoglobinFromVolume(currentState, previousState, dt);
  calibrateProfileSpecificVolumeResponse(currentState, previousState, dt);
  calibrateDo2Vo2AndLactate(currentState, dt);
  calibrateMapAndDerived(currentState, previousState, dt);
  currentState.hidden.lastCalibrationTick = currentState.timeSec;
  return currentState;
};

export const initializeCase = (caseJson: CaseData, seed: number): PatientState => {
  const normalizedSeed = seed >>> 0;
  let rngState = normalizedSeed === 0 ? 1 : normalizedSeed;
  const profileParameters = normalizeProfileParameters(caseJson.profileParameters);

  const hidden: HiddenPhysiology = normalizeHidden({ ...caseJson.initialHidden });

  if (caseJson.hiddenRanges) {
    for (const [key, range] of Object.entries(caseJson.hiddenRanges)) {
      if (!range) {
        continue;
      }
      const [min, max] = range;
      const random = nextMulberry32(rngState);
      rngState = random.state;
      const sampled = min + random.value * (max - min);
      (hidden as unknown as Record<string, number>)[key] = sampled;
    }
  }

  const randomSensitivity = nextMulberry32(rngState);
  rngState = randomSensitivity.state;

  hidden.catecholamineSensitivity = clamp(
    hidden.catecholamineSensitivity +
      (randomSensitivity.value - 0.5) * 2 * caseJson.seedVariability.catecholamineSensitivitySpread,
    0.35,
    1.9
  );

  const randomExtraction = nextMulberry32(rngState);
  rngState = randomExtraction.state;

  hidden.extractionEfficiency = clamp(
    hidden.extractionEfficiency +
      (randomExtraction.value - 0.5) * 2 * caseJson.seedVariability.extractionEfficiencySpread,
    0.25,
    0.95
  );

  const randomCardio = nextMulberry32(rngState);
  rngState = randomCardio.state;
  if (randomCardio.value < caseJson.seedVariability.cardiomyopathyChance) {
    hidden.septicCardiomyopathy = clamp(0.45 + randomCardio.value, 0.45, 1);
  } else {
    hidden.septicCardiomyopathy = 0;
  }

  hidden.rbcMass = clamp((hidden.hemoglobin * hidden.bloodVolume) / 100, 120, 1500);

  const visible: VisibleState = {
    ...baselineVisible,
    ...caseJson.initialVisible,
    bsa: caseJson.initialVisible.bsa ?? baselineVisible.bsa,
    hb: caseJson.initialVisible.hb ?? hidden.hemoglobin ?? baselineVisible.hb,
    lactate: caseJson.initialVisible.lactate ?? baselineVisible.lactate,
    fio2: hidden.ventilatorFio2,
    peep: hidden.ventilatorPeep,
    vt: hidden.ventilatorVt
  };

  hidden.volumeChallengeReferenceCo =
    hidden.volumeChallengeReferenceCo && hidden.volumeChallengeReferenceCo > 0
      ? hidden.volumeChallengeReferenceCo
      : visible.cardiacOutput;
  hidden.volumeChallengeActive = false;

  const initialState: PatientState = {
    caseId: caseJson.id,
    caseName: caseJson.name,
    timeSec: 0,
    seed,
    rngState,
    visible,
    hidden,
    profileParameters,
    progression: caseJson.progression,
    scheduledEffects: [],
    engineEvents: []
  };

  return initialState;
};

export const applyIntervention = (
  patientState: PatientState,
  intervention: Intervention
): PatientState => {
  const next: PatientState = {
    ...patientState,
    hidden: { ...patientState.hidden },
    scheduledEffects: [...patientState.scheduledEffects],
    engineEvents: []
  };

  const hidden = next.hidden;

  const sensitivityTag =
    hidden.catecholamineSensitivity < 0.75
      ? 'baixa'
      : hidden.catecholamineSensitivity > 1.15
      ? 'alta'
      : 'intermediaria';

  switch (intervention.type) {
    case 'set_norepinephrine_rate': {
      const rate = clamp(intervention.value ?? 0, 0, 3);
      const picked = pickOnset(next.rngState, 30, 90);
      next.rngState = picked.rngState;
      hidden.pendingNorepinephrineRate = rate;
      hidden.norepinephrineApplyAtSec = next.timeSec + picked.onset;
      const effective = rate * hidden.catecholamineSensitivity;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Norad ajustada para ${rate.toFixed(3)} mcg/kg/min. Efeito esperado em ${picked.onset}s. Dose efetiva estimada ${effective.toFixed(3)} (sensibilidade ${sensitivityTag}).`
      );
      if (rate > 1.5) {
        pushEvent(
          next.engineEvents,
          next.timeSec,
          'adverse',
          'Aviso: dose extrema de norad, com ganho marginal menor e maior risco de eventos adversos.'
        );
      }
      break;
    }
    case 'set_dobutamine_rate': {
      const rate = clamp(intervention.value ?? 0, 0, 20);
      const picked = pickOnset(next.rngState, 20, 60);
      next.rngState = picked.rngState;
      hidden.pendingDobutamineRate = rate;
      hidden.dobutamineApplyAtSec = next.timeSec + picked.onset;
      const effective = rate * hidden.catecholamineSensitivity;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Dobutamina ajustada para ${rate.toFixed(1)} mcg/kg/min. Efeito esperado em ${picked.onset}s. Dose efetiva estimada ${effective.toFixed(1)} (sensibilidade ${sensitivityTag}).`
      );
      break;
    }
    case 'set_vasopressin_rate': {
      const rate = clamp(intervention.value ?? 0, 0, 0.06);
      const picked = pickOnset(next.rngState, 60, 180);
      next.rngState = picked.rngState;
      hidden.pendingVasopressinRate = rate;
      hidden.vasopressinApplyAtSec = next.timeSec + picked.onset;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Vasopressina ajustada para ${rate.toFixed(3)} U/min. Efeito esperado em ${picked.onset}s.`
      );
      break;
    }
    case 'give_fluid_bolus': {
      const effect = createEffectFromIntervention(next.timeSec, intervention);
      if (effect) {
        next.scheduledEffects.push(effect);
      }
      const volumeMl = clamp(intervention.volumeMl ?? 250, 50, 1500);
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Bolus ${volumeMl} mL iniciado. Efeito hemodinamico esperado em 10-120s com pico progressivo.`
      );
      break;
    }
    case 'give_transfusion': {
      const targetHb = intervention.targetHb ?? 0;
      const effect = createEffectFromIntervention(next.timeSec, intervention);
      if (effect) {
        const requestedRise = effect.channels.hb ?? 0;
        if (requestedRise > 0) {
          if (targetHb > 0) {
            const deficit = targetHb - hidden.hemoglobin;
            if (deficit <= 0) {
              effect.channels.hb = 0;
            } else {
              const asymptoticFraction =
                1 - Math.exp(-deficit / Math.max(requestedRise * 0.45, 0.12));
              effect.channels.hb = clamp(requestedRise * asymptoticFraction, 0, requestedRise);
            }
          }
        }
        next.scheduledEffects.push(effect);
      }
      const units = clamp(intervention.units ?? 1, 1, 2);
      const suffix = targetHb > 0 ? ` alvo Hb ${targetHb.toFixed(1)} g/dL.` : '';
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `Transfusao ${units}U iniciada. Efeito em Hb/DO2 esperado em 5-20 min.${suffix}`
      );
      break;
    }
    case 'set_fio2': {
      const value = clamp(intervention.value ?? hidden.ventilatorFio2Target, 0.21, 1);
      hidden.ventilatorFio2Target = value;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `FiO2 ajustada para ${(value * 100).toFixed(0)}%. Estabilizacao em 20-60s.`
      );
      break;
    }
    case 'set_peep': {
      const value = clamp(intervention.value ?? hidden.ventilatorPeepTarget, 5, 20);
      hidden.ventilatorPeepTarget = value;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `PEEP ajustada para ${value.toFixed(0)} cmH2O. Efeito hemodinamico em 30-120s.`
      );
      break;
    }
    case 'set_vt': {
      const value = clamp(intervention.value ?? hidden.ventilatorVtTarget, 280, 750);
      hidden.ventilatorVtTarget = value;
      pushEvent(
        next.engineEvents,
        next.timeSec,
        'info',
        `VT ajustado para ${value.toFixed(0)} mL. Reequilibrio ventilatorio em 30-90s.`
      );
      break;
    }
    default:
      break;
  }

  return next;
};

export const deriveVisibleFromHidden = (patientState: PatientState, dt = 1): PatientState => {
  const next: PatientState = {
    ...patientState,
    hidden: { ...patientState.hidden },
    visible: { ...patientState.visible },
    scheduledEffects: [...patientState.scheduledEffects],
    engineEvents: []
  };

  const coupled = runCoupledPass(next, dt);
  return applyPhysiologyCalibration(coupled, patientState, dt);
};

export const step = (patientState: PatientState, dt: number): PatientState => {
  const next = coupledStep(patientState, dt);
  return applyPhysiologyCalibration(next, patientState, dt);
};

export const __testOnlyApplyPhysiologyCalibration = (
  currentState: PatientState,
  previousState: PatientState,
  dt: number
): PatientState => {
  return applyPhysiologyCalibration(currentState, previousState, dt);
};
