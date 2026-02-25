import { clamp, jitter, sigmoid } from '@/engine/math';
import { CouplingState } from '@/engine/coupling';
import { PatientState } from '@/engine/types';

export const updateVenousReturn = (
  state: PatientState,
  coupling: CouplingState,
  dt: number
): void => {
  const hidden = state.hidden;

  const stressedVolumeTerm = (hidden.bloodVolume - 4000) / 220;
  const venousComplianceTerm = 1 / Math.max(hidden.venousCompliance, 0.45);
  const vasopressinVenousTone = hidden.vasopressinDrive * 1.2;

  const pmsTarget = clamp(
    6 + stressedVolumeTerm * venousComplianceTerm + vasopressinVenousTone,
    3,
    28
  );
  coupling.pms += (pmsTarget - coupling.pms) * (dt / 25);

  const rapBase =
    3.2 +
    coupling.intrathoracicPressure * 0.16 +
    hidden.arrhythmiaBurden * 1.8 +
    Math.max(0, coupling.pvr - 240) * 0.0022;
  const rapTarget = clamp(0.65 * hidden.rightAtrialPressure + 0.35 * rapBase, 1, 28);
  coupling.rap += (rapTarget - coupling.rap) * (dt / 18);

  coupling.venousResistance = clamp(
    hidden.venousResistanceBase * (1 + hidden.vasoconstrictionBurden * 0.4) / Math.max(hidden.venousCompliance, 0.45),
    0.4,
    5
  );

  const vr = (coupling.pms - coupling.rap) / Math.max(coupling.venousResistance, 0.2);
  const venousFloor = clamp(
    1.2 +
      Math.max(0, coupling.pms - 9) * 0.28 +
      hidden.norepinephrineDrive * 0.25 -
      Math.max(0, coupling.intrathoracicPressure - 12) * 0.04,
    0.7,
    2.6
  );
  const venousTarget = clamp(vr, venousFloor, 18);
  coupling.venousReturn += (venousTarget - coupling.venousReturn) * (dt / 18);
  coupling.venousReturn = clamp(coupling.venousReturn, 0, 18);

  hidden.meanSystemicFillingPressure = coupling.pms;
  hidden.rightAtrialPressure = coupling.rap;
  hidden.venousReturnFlow = coupling.venousReturn;
};

export const updateRightVentricle = (
  state: PatientState,
  coupling: CouplingState,
  dt: number
): void => {
  const hidden = state.hidden;

  const norepiEffect = hidden.norepinephrineDrive * hidden.catecholamineSensitivity;
  const dobutamineEffect = hidden.dobutamineDrive * hidden.catecholamineSensitivity;

  const rvContractility = clamp(
    hidden.contractilityRV * (1 + 0.6 * dobutamineEffect) * (1 - hidden.arrhythmiaBurden * 0.14),
    0.3,
    1.9
  );

  const rvStarling = sigmoid(coupling.venousReturn, 3.9, 0.8);
  const rvAfterloadPenalty = clamp(
    Math.max(0, coupling.pvr - 220) / 1150 + Math.max(0, coupling.pvr - hidden.basalPVR) / 1800,
    0,
    0.82
  );

  const intrinsicRvOutput = clamp(
    1.1 + 11.5 * rvStarling * rvContractility * (1 - rvAfterloadPenalty),
    0.3,
    14
  );

  coupling.rvOutput = clamp(0.7 * intrinsicRvOutput + 0.3 * coupling.venousReturn, 0.3, 14);

  const hr = coupling.hr;
  coupling.rvStrokeVolume = clamp((coupling.rvOutput * 1000) / Math.max(hr, 40), 10, 180);

  const rapMismatch = coupling.venousReturn - coupling.rvOutput;
  hidden.rightAtrialPressure = clamp(
    hidden.rightAtrialPressure + rapMismatch * 0.04 * dt - (hidden.rightAtrialPressure - 7) * (dt / 900),
    1,
    30
  );

  hidden.rightAtrialPressure += norepiEffect * 0.01 * dt;
  hidden.rightAtrialPressure = clamp(hidden.rightAtrialPressure, 1, 30);
};

export const updateLeftVentricle = (
  state: PatientState,
  coupling: CouplingState,
  dt: number
): void => {
  const hidden = state.hidden;

  const dobutamineEffect = hidden.dobutamineDrive * hidden.catecholamineSensitivity;

  const lvPreloadTarget = clamp(
    500 +
      (coupling.pulmonaryFlow - 5) * 72 +
      (coupling.venousReturn - 5) * 48 +
      (coupling.pms - 10) * 28 -
      (coupling.intrathoracicPressure - 6) * 9 -
      hidden.ardsSeverity * 30 +
      hidden.leftAtrialPressure * 7,
    250,
    1450
  );

  coupling.lvPreloadIndex += (lvPreloadTarget - coupling.lvPreloadIndex) * (dt / 24);

  const preloadTransfer = clamp(hidden.lvCompliance, 0.2, 1.3);
  const effectivePreload = coupling.lvPreloadIndex * preloadTransfer;
  const pumpFailure = clamp(
    (0.65 - hidden.contractilityLV) / 0.4 + Math.max(0, hidden.leftAtrialPressure - 14) / 10,
    0,
    1.5
  );
  const starlingEfficiency = clamp(1 - pumpFailure * 0.6, 0.2, 1);
  const lvStarling = sigmoid(effectivePreload, 620, 85) * starlingEfficiency;
  const lvAfterloadPenalty = clamp(
    (coupling.svr - hidden.basalSVR) / Math.max(hidden.basalSVR, 300) * 0.2,
    0,
    0.5
  );
  const congestionBurden =
    Math.max(0, hidden.leftAtrialPressure - 14) / 18 +
    Math.max(0, coupling.lvPreloadIndex - 850) / 480 +
    Math.max(0, hidden.fluidOverload) / 2600;
  const congestionPenaltyRaw = congestionBurden * (1 / Math.max(hidden.lvCompliance, 0.35)) * 0.4;
  const congestionPenaltyRelief = dobutamineEffect * 0.15;
  const congestionPenalty = clamp(congestionPenaltyRaw - congestionPenaltyRelief, 0, 0.75);

  const lvContractility = clamp(
    hidden.contractilityLV *
      (1 + 0.95 * dobutamineEffect) *
      (1 - hidden.septicCardiomyopathy * 0.25) *
      (1 - hidden.arrhythmiaBurden * 0.18) *
      (1 - congestionPenalty),
    0.12,
    2.1
  );

  const intrinsicLvOutput = clamp(
    0.8 + 10.8 * lvStarling * lvContractility * (1 - lvAfterloadPenalty),
    0.4,
    15
  );

  const pulmonaryTransferWeight = clamp(
    0.18 + 0.22 * clamp(lvContractility, 0.2, 1.2) - 0.2 * congestionPenalty,
    0.05,
    0.45
  );
  coupling.lvOutput = clamp(
    intrinsicLvOutput * (1 - pulmonaryTransferWeight) + coupling.pulmonaryFlow * pulmonaryTransferWeight,
    0.4,
    15
  );

  coupling.lvStrokeVolume = clamp((coupling.lvOutput * 1000) / Math.max(coupling.hr, 40), 10, 190);

  hidden.leftAtrialPressure = clamp(
    hidden.leftAtrialPressure + (coupling.pulmonaryFlow - coupling.lvOutput) * 0.05 * dt,
    2,
    30
  );
  hidden.leftVentricularPreload = coupling.lvPreloadIndex;
};

export const updateSystemicCirculation = (
  state: PatientState,
  coupling: CouplingState,
  dt: number
): void => {
  const hidden = state.hidden;

  const norepiEffect = hidden.norepinephrineDrive * hidden.catecholamineSensitivity;
  const dobutamineEffect = hidden.dobutamineDrive * hidden.catecholamineSensitivity;
  const vasopressinEffect = hidden.vasopressinDrive;

  const vasoplegiaFactor = 1 / (1 + hidden.systemicInflammation * 0.55);

  const svrTarget = clamp(
    hidden.basalSVR *
      hidden.basalTone *
      vasoplegiaFactor *
      (1 + 1.55 * norepiEffect + 1.3 * vasopressinEffect) *
      (1 - 0.14 * dobutamineEffect) *
      (1 + hidden.vasoconstrictionBurden * 0.25),
    220,
    4200
  );

  coupling.svr += (svrTarget - coupling.svr) * (dt / 30);

  const tempTarget = clamp(37 + hidden.systemicInflammation * 0.65 - hidden.sedationFactor * 0.3, 34, 41);
  coupling.temperature += (tempTarget - coupling.temperature) * (dt / 200);

  const hrTarget = clamp(
    78 +
      hidden.systemicInflammation * 21 +
      norepiEffect * 14 +
      dobutamineEffect * 17 +
      hidden.arrhythmiaBurden * 26 +
      (coupling.temperature - 37) * 6 -
      hidden.sedationFactor * 18,
    45,
    190
  );

  coupling.hr += (hrTarget - coupling.hr) * (dt / 15);
  coupling.hr = clamp(coupling.hr, 45, 190);

  const flowNoise = jitter(state.rngState, 0.08);
  state.rngState = flowNoise.state;
  coupling.lvOutput = clamp(coupling.lvOutput + flowNoise.value, 0.3, 15);

  coupling.map = clamp((coupling.lvOutput * coupling.svr) / 80 + coupling.rap, 25, 150);
  coupling.cvp = coupling.rap;

  coupling.gedi = clamp(coupling.lvPreloadIndex, 300, 1500);
  coupling.itbv = clamp(coupling.gedi * 1.24, 450, 1900);

  const hydrostaticStress = Math.max(
    0,
    (coupling.cvp - 10) / 8 +
      (coupling.itbv - 900) / 420 +
      (hidden.leftAtrialPressure - 10) / 7 +
      hidden.fluidOverload / 2200
  );
  coupling.evlw = clamp(6.5 + hidden.capillaryLeak * 5.8 + hydrostaticStress * 3.1, 4, 35);
  coupling.pvpi = clamp(1.15 + (hidden.capillaryLeak * 2.1) / (1 + hydrostaticStress * 0.85), 1, 8);

  hidden.pulmonaryResistance = coupling.pvr;
  hidden.pulmonaryArteryPressure = clamp(
    hidden.pulmonaryArteryPressure + (((coupling.rvOutput * coupling.pvr) / 80 + hidden.leftAtrialPressure) - hidden.pulmonaryArteryPressure) * (dt / 25),
    8,
    70
  );
};
