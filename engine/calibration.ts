/**
 * Calibration overlay functions — the second-layer physiological pipeline
 * that adjusts coupled-pass outputs to produce clinically realistic
 * hemodynamic values.  Each function targets a specific subsystem.
 *
 * Re-exported via model.ts (public API unchanged).
 */
import { clamp, sigmoid } from '@/engine/math';
import { PatientState } from '@/engine/types';
import { logClampActivation, physiologicalOffset } from '@/engine/defaults';

// ── Internal helpers ──────────────────────────────────────────────────

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

// ── Calibration functions (called in order by applyPhysiologyCalibration) ──

export const calibratePvrAndVdVeCoupling = (state: PatientState, dt: number): void => {
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

export const calibratePreloadFromVolume = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;

  const intrathoracicBackpressure =
    Math.max(0, hidden.rightAtrialPressure - 7) * profile.preloadBackpressureScale;
  const congestionVolumeLoad =
    Math.max(0, hidden.leftAtrialPressure - 14) * profile.preloadCongestionToGedi +
    Math.max(0, hidden.fluidOverload) * profile.gediFluidWeight;
  const bloodVolumeContribution =
    (sigmoid(hidden.bloodVolume, 4600, 600) - 0.5) * profile.volumeResponseBloodVolumeScale;
  const venousReturnContribution =
    (sigmoid(hidden.venousReturnFlow, 4.8, 1.45) - 0.5) * (95 + profile.volumeResponsePmsGain * 120);
  const pmsContribution =
    (sigmoid(hidden.meanSystemicFillingPressure, 10.5, 1.6) - 0.5) * (70 + profile.volumeResponsePmsClamp * 45);
  const leakAttenuation = clamp(1 - hidden.capillaryLeak * 0.22 - hidden.systemicInflammation * 0.05, 0.45, 1);

  const eqBV = hidden.equilibriumGEDI > 0
    ? (hidden.bloodVolume > 3000 ? hidden.bloodVolume : 5000)
    : 5000;
  const initBV = hidden.equilibriumCO > 0.1 ? 5000 : 5000;
  const directBvToGedi = (hidden.bloodVolume - 5000) * 0.06;

  const gediFromVolume = clamp(
    670 +
      bloodVolumeContribution * leakAttenuation +
      venousReturnContribution * leakAttenuation +
      pmsContribution * (0.75 + 0.25 * leakAttenuation) +
      directBvToGedi * leakAttenuation -
      intrathoracicBackpressure -
      hidden.ardsSeverity * profile.preloadArdsPenaltyScale +
      congestionVolumeLoad,
    280,
    1500
  );

  const tauVolumeSec = 16;
  const tauPreloadSec = 16;

  const volumeDrivenPreloadTarget = clamp(
    gediFromVolume * 0.64 + hidden.leftVentricularPreload * 0.36,
    280,
    1600
  );

  const gediTauVolume = volumeDrivenPreloadTarget > visible.gedi ? tauVolumeSec : tauVolumeSec + 24;
  visible.gedi += (volumeDrivenPreloadTarget - visible.gedi) * clamp(dt / gediTauVolume, 0.006, 0.08);
  visible.gedi = clamp(visible.gedi, 280, 1600);
  hidden.leftVentricularPreload +=
    (volumeDrivenPreloadTarget - hidden.leftVentricularPreload) *
    clamp(dt / (volumeDrivenPreloadTarget > hidden.leftVentricularPreload ? tauPreloadSec : tauPreloadSec + 22), 0.006, 0.09);
};

export const calibrateFrankStarling = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const profile = state.profileParameters;

  const gedi = 0.65 * visible.gedi + 0.35 * hidden.leftVentricularPreload;

  // --- preload signal (volume-responsive shift) ---
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

  const eqGEDI = hidden.equilibriumGEDI > 0 ? hidden.equilibriumGEDI : (profile.gediBase > 0 ? profile.gediBase : 640);
  const gediRatio = eqGEDI > 50 ? gedi / eqGEDI : 1;
  const preloadMultiplier = clamp(
    1 + (gediRatio - 1) * preloadResponsiveness * 0.85,
    0.55,
    1.6
  );

  // --- contractility signal ---
  const contractilityProduct = hidden.contractilityLV * profile.contractilityBaseline;
  const contractilityDeficit = clamp((0.9 - contractilityProduct) / 0.4, 0, 1);
  const noradInotropyTerm =
    hidden.norepinephrineDrive *
    hidden.catecholamineSensitivity *
    profile.betaSensitivity *
    0.45 *
    contractilityDeficit;

  const contractility = clamp(
    hidden.contractilityLV *
      profile.contractilityBaseline *
      (1 - hidden.septicCardiomyopathy * 0.18) *
      (1 +
        profile.dobutamineContractilityGain *
          hidden.dobutamineDrive *
          hidden.catecholamineSensitivity *
          profile.betaSensitivity +
        noradInotropyTerm),
    0.22,
    2.2
  );
  const refContractility = clamp(
    hidden.contractilityLV * profile.contractilityBaseline,
    0.22,
    2.2
  );
  const contractilityRatio = refContractility > 0.1 ? contractility / refContractility : 1;
  const contractilityMultiplier = clamp(contractilityRatio, 0.4, 1.6);

  // --- afterload signal ---
  const refSVR = hidden.equilibriumSVR > 0 ? hidden.equilibriumSVR : hidden.basalSVR;
  let afterloadPenalty = clamp(
    (visible.svr - refSVR) / Math.max(refSVR, 300),
    -0.25,
    0.5
  );
  const inodilatorRelief =
    hidden.dobutamineDrive *
    hidden.catecholamineSensitivity *
    profile.betaSensitivity *
    profile.dobutamineAfterloadRelief;
  afterloadPenalty = clamp(afterloadPenalty - inodilatorRelief, -0.25, 0.5);
  const afterloadMultiplier = clamp(1 - Math.max(afterloadPenalty, 0) * 0.12, 0.75, 1.1);

  // --- dobutamine direct flow support ---
  const inotropySignal =
    hidden.dobutamineDrive *
    hidden.catecholamineSensitivity *
    profile.betaSensitivity;
  const lowFlowNeed = clamp((2.6 - visible.cardiacOutput) / 1.8, 0, 1.2);
  const rawDobutamineSupport =
    clamp(inotropySignal, 0, 6) *
    (profile.dobutamineFlowSupportBase + lowFlowNeed * profile.dobutamineFlowSupportLowOutputGain);
  const dobuCapCO = hidden.equilibriumCO > 0.1 ? hidden.equilibriumCO : visible.cardiacOutput;
  const dobutamineSupport = Math.min(rawDobutamineSupport, dobuCapCO * 0.4);

  // --- congestion penalty (cardiogenic profiles) ---
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

  // --- volume recruitment bonus ---
  const volumeRecruitment = sigmoid(hidden.bloodVolume, 3850, 600);
  const eqBVol = hidden.equilibriumBloodVolume > 0 ? hidden.equilibriumBloodVolume : hidden.bloodVolume;
  const eqVolumeRecruitment = sigmoid(eqBVol, 3850, 600);
  const volumeRecruitmentDelta = Math.max(0, volumeRecruitment - eqVolumeRecruitment);
  const rawVolumeRecruitmentBonus = profile.volumeRecruitmentGain * volumeRecruitmentDelta;
  const eqCOForCap = hidden.equilibriumCO > 0.1 ? hidden.equilibriumCO : visible.cardiacOutput;
  const volumeRecruitmentBonus = Math.min(rawVolumeRecruitmentBonus, eqCOForCap * 0.25);

  // --- plateau (descending limb at very high GEDI) ---
  const plateau = clamp(
    clamp(1 - Math.max(0, gedi - 960) / 760, 0.35, 1.05) * profile.plateauScale,
    0.3,
    1.15
  );

  // --- composite CO target ---
  const eqCO = hidden.equilibriumCO > 0.1 ? hidden.equilibriumCO : visible.cardiacOutput;

  const rawProduct =
    preloadMultiplier *
    contractilityMultiplier *
    afterloadMultiplier *
    plateau *
    (1 - effectiveCongestionPenalty);

  if (hidden.equilibriumStarlingProduct <= 0.001) {
    hidden.equilibriumStarlingProduct = Math.max(rawProduct, 0.05);
  }
  const normalizedProduct = rawProduct / hidden.equilibriumStarlingProduct;
  let coTarget = eqCO * normalizedProduct;
  coTarget += dobutamineSupport + volumeRecruitmentBonus;

  const rawCoTarget = coTarget;
  coTarget = clamp(coTarget, 0.25, 15);
  logClampActivation(state, 'coTarget.starling', rawCoTarget, coTarget, 0.25, 15);

  const coTau = coTarget > visible.cardiacOutput ? 55 : 120;
  visible.cardiacOutput += (coTarget - visible.cardiacOutput) * clamp(dt / coTau, 0.005, 0.05);
  const rawCoVisible = visible.cardiacOutput;
  visible.cardiacOutput = clamp(visible.cardiacOutput, 0.25, 16);
  logClampActivation(state, 'cardiacOutput.starling', rawCoVisible, visible.cardiacOutput, 0.25, 16);
};

export const calibrateLvedpAndRightPressure = (state: PatientState, dt: number): void => {
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

export const calibrateNorepiEmax = (state: PatientState, dt: number): void => {
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
  const rawEffect = (emax * dosePow) / Math.max(dosePow + ecPow, 1e-6);
  const effect = clamp(rawEffect, 0, 0.65);

  const combinedPressCoeff = profile.pressorGainScale + 1.0;

  const rawSvrTarget =
    hidden.basalSVR *
    hidden.basalTone *
    profile.vascularToneBaseline *
    (1 + combinedPressCoeff * effect + 0.95 * hidden.vasopressinDrive - profile.dobutamineSvrOffset * hidden.dobutamineDrive) /
    (1 + hidden.systemicInflammation * 0.38);
  const svrTarget = clamp(rawSvrTarget, 220, 4700);
  logClampActivation(state, 'svrTarget.norepi', rawSvrTarget, svrTarget, 220, 4700);

  const tauVasopressorSec = effect >= hidden.norepinephrineDrive ? 24 : 34;
  visible.svr += (svrTarget - visible.svr) * clamp(dt / tauVasopressorSec, 0.02, 0.14);
  const rawVisibleSvr = visible.svr;
  visible.svr = clamp(visible.svr, 220, 4700);
  logClampActivation(state, 'svr.visible', rawVisibleSvr, visible.svr, 220, 4700);

  const secondaryAfterload = clamp(
    (visible.svr - hidden.basalSVR * 1.55) / Math.max(hidden.basalSVR * 0.9, 220),
    0,
    1.2
  );
  if (secondaryAfterload > 0) {
    const rawCoTarget = visible.cardiacOutput * (1 - secondaryAfterload * 0.01);
    const coTarget = clamp(rawCoTarget, 0.25, 16);
    logClampActivation(state, 'coTarget.norepiSecondary', rawCoTarget, coTarget, 0.25, 16);
    visible.cardiacOutput += (coTarget - visible.cardiacOutput) * clamp(dt / 28, 0.02, 0.12);
    const rawCoVisible = visible.cardiacOutput;
    visible.cardiacOutput = clamp(visible.cardiacOutput, 0.25, 16);
    logClampActivation(state, 'cardiacOutput.norepiSecondary', rawCoVisible, visible.cardiacOutput, 0.25, 16);
  }
};

export const calibrateEvlwAndCompliance = (
  state: PatientState,
  previousState: PatientState,
  dt: number
): void => {
  const hidden = state.hidden;
  const visible = state.visible;
  const deltaBloodVolume = hidden.bloodVolume - previousState.hidden.bloodVolume;

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
    3.5 +
      hidden.capillaryLeak * leakWeight +
      volumeStress * (1.2 + hidden.capillaryLeak * 0.95) +
      hydrostatic * hydroWeight,
    3,
    36
  );

  const hydroFloor = clamp(
    3.5 + lvedpHydro * 0.32 * profile.pulmonaryHydrostaticSensitivity + Math.max(0, visible.cvp - 10) * 0.18,
    3,
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

  const evlwTau = evlwTarget > visible.evlw ? 120 : 20;
  visible.evlw += (evlwTarget - visible.evlw) * clamp(dt / evlwTau, 0.004, 0.12);
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

  const tauVentilatorySec = 12;
  const peepAbove = Math.max(0, visible.peep - 8);
  const stiffness = clamp((36 - hidden.pulmonaryComplianceDynamic) / 24, 0, 1.1);

  const peepRapCap = 6 * clamp(0.82 + stiffness * 0.18, 0.7, 1);
  const peepRapContribution = clamp(peepAbove * (0.12 + 0.08 * stiffness), 0, peepRapCap);

  if (peepRapContribution > 0.01) {
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
    hidden.rightAtrialPressure += (rapTarget - hidden.rightAtrialPressure) * clamp(dt / 45, 0.01, 0.08);
    hidden.rightAtrialPressure = clamp(hidden.rightAtrialPressure, 1, 30);
  }

  const pvrExcess = Math.max(0, hidden.pulmonaryResistance - hidden.basalPVR);
  const basalPvrLoad = clamp(hidden.basalPVR / 600, 0.3, 2);
  const pvrBurden = clamp(pvrExcess / Math.max(hidden.basalPVR, 120), 0, 2.2);
  const peepHemodynamicScale = clamp(0.42 + 0.55 * basalPvrLoad + 0.32 * pvrBurden, 0.45, 2.2);
  const peepVrPenalty = clamp(peepAbove * (0.012 + 0.01 * stiffness) * peepHemodynamicScale, 0, 0.8);

  if (peepVrPenalty > 0.005) {
    const vrTarget = clamp(hidden.venousReturnFlow * (1 - peepVrPenalty), 0.3, 20);
    hidden.venousReturnFlow += (vrTarget - hidden.venousReturnFlow) * clamp(dt / 45, 0.01, 0.08);
    hidden.venousReturnFlow = clamp(hidden.venousReturnFlow, 0, 20);
  }

  const coSecondaryPenalty = clamp(
    peepAbove * (0.0025 + 0.0018 * stiffness) * clamp(0.72 + 0.42 * basalPvrLoad + 0.32 * pvrBurden, 0.6, 1.9),
    0,
    0.11
  );
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
  const totalPeepPenalty = coSecondaryPenalty + rvPenalty;
  if (totalPeepPenalty > 0.005) {
    const rawCoTarget = visible.cardiacOutput * (1 - totalPeepPenalty);
    const coTarget = clamp(rawCoTarget, 0.25, 16);
    logClampActivation(state, 'coTarget.peep', rawCoTarget, coTarget, 0.25, 16);
    visible.cardiacOutput += (coTarget - visible.cardiacOutput) * clamp(dt / 45, 0.01, 0.08);
    const rawCoVisible = visible.cardiacOutput;
    visible.cardiacOutput = clamp(visible.cardiacOutput, 0.25, 16);
    logClampActivation(state, 'cardiacOutput.peep', rawCoVisible, visible.cardiacOutput, 0.25, 16);
  }
};

export const calibrateHemoglobinFromVolume = (
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

export const calibrateDo2Vo2AndLactate = (state: PatientState, dt: number): void => {
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

export const calibrateProfileSpecificVolumeResponse = (
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

  const peepStress = sigmoid(visible.peep, 12, 2.2);
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

export const calibrateMapAndDerived = (
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
  const svo2True = visible.sao2 - extractionDelta * 100;
  const shuntFraction = clamp(hidden.functionalShunt, 0, 0.4);
  visible.svo2 = clamp(
    (1 - shuntFraction) * svo2True + shuntFraction * visible.sao2,
    20,
    95
  );

  updateDominantLimiterLog(state);
};

// ── Orchestrator ──────────────────────────────────────────────────────

export const applyPhysiologyCalibration = (
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
