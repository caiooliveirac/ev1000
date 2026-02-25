/**
 * Case initialisation — builds the initial PatientState from a CaseData
 * JSON definition, applying seed-based variability and equilibrium probing.
 */
import { clamp, nextMulberry32 } from '@/engine/math';
import {
  CaseData,
  PatientState,
  VisibleState
} from '@/engine/types';
import {
  baselineVisible,
  normalizeHidden,
  normalizeProfileParameters
} from '@/engine/defaults';
import { applyPhysiologyCalibration } from '@/engine/calibration';

export const initializeCase = (caseJson: CaseData, seed: number): PatientState => {
  const normalizedSeed = seed >>> 0;
  let rngState = normalizedSeed === 0 ? 1 : normalizedSeed;
  const profileParameters = normalizeProfileParameters(caseJson.profileParameters);

  const hidden = normalizeHidden({ ...caseJson.initialHidden });

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
  hidden.equilibriumCO = visible.cardiacOutput;
  hidden.equilibriumGEDI = visible.gedi;
  hidden.equilibriumSVR = visible.svr;
  hidden.equilibriumBloodVolume = hidden.bloodVolume;

  // Pre-compute the Starling product at equilibrium using initial values,
  // BEFORE any calibration runs (so GEDI/SVR/EVLW are still pristine).
  {
    const gedi = 0.65 * visible.gedi + 0.35 * (hidden.leftVentricularPreload || visible.gedi);
    const eqGEDI = visible.gedi;
    const gediRatio = eqGEDI > 50 ? gedi / eqGEDI : 1;
    const hypoSig =
      clamp((700 - gedi) / 250, 0, 1) *
      clamp((10 - hidden.leftAtrialPressure) / 6, 0, 1) *
      clamp((10 - visible.evlw) / 4, 0, 1);
    const cardioSig =
      clamp((hidden.leftAtrialPressure - 14) / 8, 0, 1) +
      clamp((0.65 - hidden.contractilityLV) / 0.35, 0, 1) +
      clamp((visible.evlw - 10) / 7, 0, 1);
    const sepSig = clamp((hidden.systemicInflammation - 0.8) / 1.5, 0, 1);
    const pResp = clamp(
      profileParameters.preloadResponsivenessBase + 0.58 * hypoSig - 0.34 * cardioSig + 0.08 * sepSig,
      profileParameters.preloadResponsivenessMin,
      profileParameters.preloadResponsivenessMax
    );
    const preloadMul = clamp(1 + (gediRatio - 1) * pResp * 0.7, 0.55, 1.6);
    const cLV = clamp(hidden.contractilityLV * profileParameters.contractilityBaseline, 0.22, 2.2);
    const cRef = cLV; // at init, contractility = refContractility
    const cMul = cRef > 0.1 ? cLV / cRef : 1;
    const refSVR = visible.svr;
    const aplPen = clamp((visible.svr - refSVR) / Math.max(refSVR, 300), -0.25, 0.5);
    const aplMul = clamp(1 - Math.max(aplPen, 0) * 0.14, 0.75, 1.1);
    const plat = clamp(
      clamp(1 - Math.max(0, gedi - 960) / 760, 0.35, 1.05) * profileParameters.plateauScale,
      0.3,
      1.15
    );
    const inotrope = 0; // no dobutamine at init
    const lowFlow = clamp((2.6 - visible.cardiacOutput) / 1.8, 0, 1.2);
    const congPen = clamp(
      (Math.max(0, visible.evlw - 12) / 10 +
        Math.max(0, hidden.bloodVolume - 5000) / 1500 +
        Math.max(0, hidden.leftAtrialPressure - 14) / 12) *
        clamp(cardioSig / 2.4, 0, 1),
      0,
      0.65
    );
    hidden.equilibriumStarlingProduct = Math.max(
      preloadMul * clamp(cMul, 0.4, 2.2) * aplMul * plat * (1 - clamp(congPen, 0, 0.65)),
      0.05
    );
  }

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

  // Multi-pass equilibrium refinement: run calibration on a COPY to
  // discover steady-state GEDI, SVR, EVLW, etc.
  {
    const probe: PatientState = {
      ...initialState,
      hidden: { ...initialState.hidden },
      visible: { ...initialState.visible },
      scheduledEffects: [...initialState.scheduledEffects],
      engineEvents: []
    };
    for (let i = 0; i < 300; i++) {
      applyPhysiologyCalibration(probe, probe, 1);
    }
    const pv = probe.visible;
    const ph = probe.hidden;
    const gedi2 = 0.65 * pv.gedi + 0.35 * (ph.leftVentricularPreload || pv.gedi);
    const eqGEDI2 = initialState.hidden.equilibriumGEDI;
    const gediRatio2 = eqGEDI2 > 50 ? gedi2 / eqGEDI2 : 1;
    const hypo2 =
      clamp((700 - gedi2) / 250, 0, 1) *
      clamp((10 - ph.leftAtrialPressure) / 6, 0, 1) *
      clamp((10 - pv.evlw) / 4, 0, 1);
    const cardio2 =
      clamp((ph.leftAtrialPressure - 14) / 8, 0, 1) +
      clamp((0.65 - ph.contractilityLV) / 0.35, 0, 1) +
      clamp((pv.evlw - 10) / 7, 0, 1);
    const sep2 = clamp((ph.systemicInflammation - 0.8) / 1.5, 0, 1);
    const pResp2 = clamp(
      profileParameters.preloadResponsivenessBase + 0.58 * hypo2 - 0.34 * cardio2 + 0.08 * sep2,
      profileParameters.preloadResponsivenessMin,
      profileParameters.preloadResponsivenessMax
    );
    const preloadMul2 = clamp(1 + (gediRatio2 - 1) * pResp2 * 0.7, 0.55, 1.6);
    const cLV2 = clamp(ph.contractilityLV * profileParameters.contractilityBaseline, 0.22, 2.2);
    const cMul2 = 1; // at init, no drugs → ratio = 1
    const refSVR2 = initialState.hidden.equilibriumSVR;
    const aplPen2 = clamp((pv.svr - refSVR2) / Math.max(refSVR2, 300), -0.25, 0.5);
    const aplMul2 = clamp(1 - Math.max(aplPen2, 0) * 0.14, 0.75, 1.1);
    const plat2 = clamp(
      clamp(1 - Math.max(0, gedi2 - 960) / 760, 0.35, 1.05) * profileParameters.plateauScale,
      0.3,
      1.15
    );
    const cong2 = clamp(
      (Math.max(0, pv.evlw - 12) / 10 +
        Math.max(0, ph.bloodVolume - 5000) / 1500 +
        Math.max(0, ph.leftAtrialPressure - 14) / 12) *
        clamp(cardio2 / 2.4, 0, 1),
      0,
      0.65
    );
    initialState.hidden.equilibriumStarlingProduct = Math.max(
      preloadMul2 * clamp(cMul2, 0.4, 1.6) * aplMul2 * plat2 * (1 - clamp(cong2, 0, 0.65)),
      0.05
    );
    initialState.hidden.equilibriumGEDI = gedi2 > 50 ? gedi2 : initialState.hidden.equilibriumGEDI;
  }

  return initialState;
};
