import { buildInitialCoupling, CouplingState } from '@/engine/coupling';
import {
  updateLeftVentricle,
  updateRightVentricle,
  updateSystemicCirculation,
  updateVenousReturn
} from '@/engine/cardiovascular';
import { updatePulmonaryCirculation } from '@/engine/pulmonary';
import { updateGasExchange } from '@/engine/gasExchange';
import { updateVentilation } from '@/engine/ventilation';
import { updateMicrocirculation } from '@/engine/microcirculation';
import { evaluateEffectIntensity } from '@/engine/effects';
import { clamp, nextMulberry32 } from '@/engine/math';
import { EngineEvent, PatientState } from '@/engine/types';

const effectNormalizedArea = (riseSec: number, peakSec: number, decaySec: number): number => {
  return Math.max(1, riseSec / 2 + peakSec + decaySec / 2);
};

const pushEvent = (state: PatientState, kind: EngineEvent['kind'], message: string): void => {
  state.engineEvents.push({ timeSec: state.timeSec, kind, message });
};

const rand = (state: PatientState): number => {
  const random = nextMulberry32(state.rngState);
  state.rngState = random.state;
  return random.value;
};

const applyDiseaseProgression = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const progression = state.progression;

  const leakStep = (progression.leakPerHour / 3600) * dt;
  const mitoStep = (progression.mitoPerHour / 3600) * dt;
  const shuntStep = (progression.microShuntPerHour / 3600) * dt;
  const inflammationStep = (progression.inflammationPerHour / 3600) * dt;
  const desensStep = (progression.catecholamineDesensPerHour / 3600) * dt;
  const cardioStep = (progression.cardiomyopathyPerHour / 3600) * dt;

  hidden.capillaryLeak = clamp(hidden.capillaryLeak + leakStep * (1 + hidden.systemicInflammation * 0.3), 0, 2.8);
  hidden.mitochondrialDysfunction = clamp(hidden.mitochondrialDysfunction + mitoStep, 0, 2.6);
  hidden.microShunt = clamp(hidden.microShunt + shuntStep * (1 + hidden.capillaryLeak * 0.1), 0, 0.85);
  hidden.systemicInflammation = clamp(hidden.systemicInflammation + inflammationStep, 0, 3.2);
  hidden.catecholamineSensitivity = clamp(hidden.catecholamineSensitivity - desensStep, 0.25, 1.8);

  // Progressive catecholamine refractoriness when shock remains uncontrolled.
  const instability = clamp(
    Math.max(0, 65 - state.visible.map) / 30 +
      Math.max(0, state.visible.lactate - 2.2) / 8 +
      hidden.systemicInflammation * 0.12,
    0,
    1.8
  );
  hidden.catecholamineSensitivity = clamp(
    hidden.catecholamineSensitivity - instability * (dt / 18000),
    0.2,
    1.8
  );

  // Acidemia/hypoxemia reduce effective contractility over time.
  const acidHypoxiaStress = clamp(
    Math.max(0, 7.32 - state.visible.ph) * 2.5 + Math.max(0, 70 - state.visible.pao2) / 70,
    0,
    1.8
  );
  if (acidHypoxiaStress > 0.05) {
    hidden.contractilityLV = clamp(hidden.contractilityLV - acidHypoxiaStress * (dt / 26000), 0.25, 1.8);
    hidden.contractilityRV = clamp(hidden.contractilityRV - acidHypoxiaStress * (dt / 23000), 0.25, 1.8);
  }

  if (hidden.septicCardiomyopathy > 0) {
    hidden.contractilityLV = clamp(
      hidden.contractilityLV - cardioStep * hidden.septicCardiomyopathy,
      0.3,
      1.8
    );
    hidden.contractilityRV = clamp(
      hidden.contractilityRV - cardioStep * hidden.septicCardiomyopathy * 0.5,
      0.3,
      1.8
    );
  }
};

const applyScheduledBolusAndTransfusion = (state: PatientState, dt: number): void => {
  const now = state.timeSec;

  for (const effect of state.scheduledEffects) {
    const intensity = evaluateEffectIntensity(effect, now);
    if (intensity <= 0) {
      continue;
    }

    const area = effectNormalizedArea(effect.riseSec, effect.peakSec, effect.decaySec);
    const flowFactor = (intensity * dt) / area;

    if (effect.channels.bloodVolume) {
      const infusedVolume = effect.channels.bloodVolume * flowFactor;
      if (effect.interventionType === 'give_fluid_bolus') {
        const leak = clamp(state.hidden.capillaryLeak, 0, 2.4);
        const inflammation = clamp(state.hidden.systemicInflammation / 3, 0, 1);
        const venousToneComponent = clamp((state.hidden.venousCompliance - 1) * 0.08, -0.05, 0.05);
        const hypovolemiaBonus = clamp((5000 - state.hidden.bloodVolume) / 3400, 0, 0.28);
        const distensionPenalty = clamp(
          Math.pow(clamp((state.hidden.bloodVolume - 5000) / 2200, 0, 1.6), 1.2) * 0.26,
          0,
          0.26
        );
        const overloadPenalty = clamp(
          Math.pow(clamp(state.hidden.fluidOverload / 2600, 0, 1.8), 1.25) * 0.22,
          0,
          0.22
        );
        // Crystalloid intravascular retention: at the moment of infusion ~100%
        // is IV; by 30 min ~20-25% remains (Hahn 2020).  The effect curve
        // distributes volume over rise/peak/decay (~5 min), so the fraction
        // here represents the AVERAGE retention during the hemodynamic window
        // that a clinician observes (5-15 min), which is ~45-55%.
        const intravascularFraction = clamp(
          0.50 -
            leak * 0.08 -
            inflammation * 0.05 +
            venousToneComponent +
            hypovolemiaBonus * 0.55 -
            distensionPenalty -
            overloadPenalty,
          0.15,
          0.75
        );
        state.hidden.bloodVolume += infusedVolume * intravascularFraction;
        state.hidden.fluidOverload += infusedVolume * (1 - intravascularFraction);
      } else {
        state.hidden.bloodVolume += infusedVolume;
      }
    }

    if (effect.channels.hb) {
      // Packed red cells add both mass and volume; use an empirical 72 g scale to
      // approximate ~1 g/dL rise per unit in non-bleeding adults after distribution.
      state.hidden.rbcMass += effect.channels.hb * 72 * flowFactor;
    }
  }

  state.hidden.rbcMass = clamp(state.hidden.rbcMass, 120, 1500);
  state.hidden.bloodVolume = clamp(state.hidden.bloodVolume, 3000, 8000);
  state.hidden.hemoglobin = clamp(
    state.hidden.rbcMass / Math.max(state.hidden.bloodVolume / 100, 20),
    4,
    19
  );
};

const updateInfusionCommands = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;
  const now = state.timeSec;

  if (hidden.norepinephrineApplyAtSec > 0 && now >= hidden.norepinephrineApplyAtSec) {
    hidden.norepinephrineRate = hidden.pendingNorepinephrineRate;
    hidden.norepinephrineApplyAtSec = 0;
    pushEvent(state, 'info', `Norad efetiva na bomba: ${hidden.norepinephrineRate.toFixed(3)} mcg/kg/min.`);
  }

  if (hidden.dobutamineApplyAtSec > 0 && now >= hidden.dobutamineApplyAtSec) {
    hidden.dobutamineRate = hidden.pendingDobutamineRate;
    hidden.dobutamineApplyAtSec = 0;
    pushEvent(state, 'info', `Dobutamina efetiva na bomba: ${hidden.dobutamineRate.toFixed(1)} mcg/kg/min.`);
  }

  if (hidden.vasopressinApplyAtSec > 0 && now >= hidden.vasopressinApplyAtSec) {
    hidden.vasopressinRate = hidden.pendingVasopressinRate;
    hidden.vasopressinApplyAtSec = 0;
    pushEvent(state, 'info', `Vasopressina efetiva na bomba: ${hidden.vasopressinRate.toFixed(3)} U/min.`);
  }

  const vasoplegiaSeverity = clamp(hidden.systemicInflammation / 2.4, 0, 1.4);
  const sens = clamp(hidden.catecholamineSensitivity, 0.2, 2);

  // Emax model with sensitivity + vasoplegia dependent EC50 and diminishing returns.
  const emax = clamp(1.1 + 0.9 * sens - 0.28 * vasoplegiaSeverity, 0.35, 2.2);
  const ec50 = clamp(0.14 + 0.2 * vasoplegiaSeverity + (1 - sens) * 0.08, 0.04, 0.8);
  const hill = 1.35;
  const dose = clamp(hidden.norepinephrineRate, 0, 3);
  const dosePow = Math.pow(dose, hill);
  const ecPow = Math.pow(ec50, hill);
  const norepiTarget = clamp((emax * dosePow) / Math.max(ecPow + dosePow, 1e-6), 0, 2.3);

  const dobuTarget = clamp(1.2 * (1 - Math.exp(-0.16 * hidden.dobutamineRate)), 0, 1.25);
  const vasoTarget = clamp(1.15 * (1 - Math.exp(-26 * hidden.vasopressinRate)), 0, 1.2);

  const norepiTau = norepiTarget > hidden.norepinephrineDrive ? 90 : 240;
  const dobuTau = dobuTarget > hidden.dobutamineDrive ? 70 : 180;
  const vasoTau = vasoTarget > hidden.vasopressinDrive ? 180 : 500;

  hidden.norepinephrineDrive += (norepiTarget - hidden.norepinephrineDrive) * (dt / norepiTau);
  hidden.dobutamineDrive += (dobuTarget - hidden.dobutamineDrive) * (dt / dobuTau);
  hidden.vasopressinDrive += (vasoTarget - hidden.vasopressinDrive) * (dt / vasoTau);

  hidden.norepinephrineDrive = clamp(hidden.norepinephrineDrive, 0, 1.3);
  hidden.dobutamineDrive = clamp(hidden.dobutamineDrive, 0, 1.3);
  hidden.vasopressinDrive = clamp(hidden.vasopressinDrive, 0, 1.2);

  if (hidden.norepinephrineRate > 1.5 && hidden.norepinephrineApplyAtSec === 0) {
    pushEvent(
      state,
      'info',
      'Dose extrema de norad: retorno marginal menor e maior risco de eventos adversos.'
    );
  }
};

const updateAdverseEvents = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;

  const arrRiskPerSec = clamp(
    Math.max(0, hidden.dobutamineRate - 6) * 0.00055 +
      Math.max(0, hidden.norepinephrineRate - 0.25) * 0.00028 +
      Math.max(0, hidden.norepinephrineRate - 1.2) * 0.0012,
    0,
    0.03
  );

  const vasoRiskPerSec = clamp(
    Math.max(0, hidden.norepinephrineRate - 0.2) * 0.00045 +
      Math.max(0, hidden.vasopressinRate - 0.03) * 0.0025 +
      Math.max(0, hidden.norepinephrineRate - 1.2) * 0.0014,
    0,
    0.03
  );

  if (rand(state) < arrRiskPerSec * dt) {
    hidden.arrhythmiaBurden = clamp(hidden.arrhythmiaBurden + 0.22, 0, 1);
    pushEvent(state, 'adverse', 'Evento adverso: taquiarritmia relacionada a catecolaminas.');
  }

  if (rand(state) < vasoRiskPerSec * dt) {
    hidden.vasoconstrictionBurden = clamp(hidden.vasoconstrictionBurden + 0.15, 0, 1);
    pushEvent(state, 'adverse', 'Evento adverso: vasoconstricao excessiva com risco de hipoperfusao periferica.');
  }

  hidden.arrhythmiaBurden += -hidden.arrhythmiaBurden * (dt / 1200);
  hidden.vasoconstrictionBurden += -hidden.vasoconstrictionBurden * (dt / 1900);

  hidden.arrhythmiaBurden = clamp(hidden.arrhythmiaBurden, 0, 1);
  hidden.vasoconstrictionBurden = clamp(hidden.vasoconstrictionBurden, 0, 1);
};

const updateVolumeCompartments = (state: PatientState, dt: number): void => {
  const hidden = state.hidden;

  const leakShift = hidden.capillaryLeak * 0.05 * dt;
  hidden.bloodVolume -= leakShift;
  hidden.fluidOverload += leakShift;

  hidden.bloodVolume += (5000 - hidden.bloodVolume) * (dt / 10800);
  hidden.fluidOverload += -hidden.fluidOverload * (dt / 16000);

  hidden.bloodVolume = clamp(hidden.bloodVolume, 3000, 8000);
  hidden.fluidOverload = clamp(hidden.fluidOverload, -500, 7000);
};

const finalizeVisible = (state: PatientState, coupling: CouplingState): PatientState => {
  const hidden = state.hidden;

  const spo2Noise = nextMulberry32(state.rngState);
  state.rngState = spo2Noise.state;
  const spo2 = clamp(coupling.sao2Fraction * 100 + (spo2Noise.value - 0.5) * 1.2, 65, 100);

  state.visible = {
    ...state.visible,
    hr: coupling.hr,
    strokeVolume: coupling.lvStrokeVolume,
    // CO is driven by the calibration overlay (Frank-Starling), not the
    // coupled biophysical pass — preserve from previous tick.
    cardiacOutput: state.visible.cardiacOutput,
    cardiacIndex: state.visible.cardiacOutput / Math.max(state.visible.bsa, 1.2),
    svr: coupling.svr,
    indexedSVR: coupling.svr * state.visible.bsa,
    map: coupling.map,
    cvp: coupling.cvp,
    svv: clamp(8 + (720 - coupling.gedi) / 35 + (hidden.ventilatorPeep - 8) * 0.9, 2, 40),
    gedi: coupling.gedi,
    itbv: coupling.itbv,
    evlw: coupling.evlw,
    pvpi: coupling.pvpi,
    svo2: coupling.svo2,
    do2: coupling.do2,
    vo2: coupling.vo2,
    hb: hidden.hemoglobin,
    lactate: coupling.lactate,
    sao2: coupling.sao2Fraction * 100,
    spo2,
    pao2: coupling.pao2,
    paco2: coupling.paco2,
    temperature: coupling.temperature,
    ph: coupling.ph,
    hco3: coupling.hco3,
    be: coupling.be,
    fio2: hidden.ventilatorFio2,
    peep: hidden.ventilatorPeep,
    vt: hidden.ventilatorVt
  };

  hidden.leftVentricularPreload = coupling.gedi;
  hidden.pulmonaryShuntFraction = coupling.shuntFraction;
  hidden.pulmonaryResistance = coupling.pvr;
  hidden.rightAtrialPressure = coupling.rap;
  hidden.meanSystemicFillingPressure = coupling.pms;
  hidden.venousReturnFlow = coupling.venousReturn;
  hidden.supplyDependencyIndex = coupling.supplyDependencyIndex;

  return state;
};

export const runCoupledPass = (state: PatientState, dt: number): PatientState => {
  const coupling = buildInitialCoupling(state.hidden, state.visible);

  // 3) Update ventilation mechanics and intrathoracic pressure.
  updateVentilation(state, coupling, dt);

  // 4) Update gas exchange from FiO2/PEEP/V-Q/shunt interactions.
  updateGasExchange(state, coupling, dt);

  // 5) Update Guyton-style venous return.
  updateVenousReturn(state, coupling, dt);

  // 6) Update right ventricle against current pulmonary afterload.
  updateRightVentricle(state, coupling, dt);

  // 7) Update pulmonary circulation (PVR, pulmonary flow coupling).
  updatePulmonaryCirculation(state, coupling, dt);

  // 8) Update left ventricle fed by pulmonary flow.
  updateLeftVentricle(state, coupling, dt);

  // 9) Update systemic circulation and derived preload/lung water states.
  updateSystemicCirculation(state, coupling, dt);

  // 10) Update microcirculation and metabolic coupling (DO2/VO2/lactate).
  updateMicrocirculation(state, coupling, dt);

  return finalizeVisible(state, coupling);
};

export const step = (patientState: PatientState, dt: number): PatientState => {
  const next: PatientState = {
    ...patientState,
    timeSec: patientState.timeSec + dt,
    hidden: { ...patientState.hidden },
    visible: { ...patientState.visible },
    scheduledEffects: [...patientState.scheduledEffects],
    engineEvents: []
  };

  // 1) Disease progression updates latent physiology.
  applyDiseaseProgression(next, dt);

  // 2) Active interventions (bolus curves, infusion commands, adverse events).
  applyScheduledBolusAndTransfusion(next, dt);
  updateInfusionCommands(next, dt);
  updateAdverseEvents(next, dt);

  // Coupled cardio-pulmonary + microcirculation pass.
  runCoupledPass(next, dt);

  updateVolumeCompartments(next, dt);

  next.scheduledEffects = next.scheduledEffects.filter(
    (effect) => next.timeSec - effect.startAtSec <= effect.durationSec
  );

  return next;
};
