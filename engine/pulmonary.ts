import { clamp } from '@/engine/math';
import { CouplingState } from '@/engine/coupling';
import { PatientState } from '@/engine/types';

export const updatePulmonaryCirculation = (
  state: PatientState,
  coupling: CouplingState,
  dt: number
): void => {
  const hidden = state.hidden;

  const peepFactor = 1 + Math.max(0, hidden.ventilatorPeep - 10) * 0.06;
  const hypoxiaFactor = 1 + Math.max(0, 80 - coupling.pao2) / 80 * 0.9;
  const acidosisFactor = 1 + Math.max(0, 7.35 - coupling.ph) * 2.1;
  const ardsFactor = 1 + hidden.ardsSeverity * 1.1;

  const pvrTarget = clamp(
    hidden.basalPVR * peepFactor * hypoxiaFactor * acidosisFactor * ardsFactor,
    80,
    2400
  );

  coupling.pvr += (pvrTarget - coupling.pvr) * (dt / 35);
  coupling.pvr = clamp(coupling.pvr, 80, 2600);

  const obstructiveBaseline = clamp(hidden.basalPVR / 600, 0.5, 2);
  const pvrBurden = clamp((coupling.pvr - hidden.basalPVR) / Math.max(hidden.basalPVR, 80), 0, 2.4);
  const rvFlowPenalty = clamp(
    pvrBurden * (0.35 + 0.25 * obstructiveBaseline) + (obstructiveBaseline - 0.5) * 0.12,
    0,
    0.88
  );
  coupling.pulmonaryFlow = clamp(coupling.rvOutput * (1 - rvFlowPenalty * 0.45), 0.2, 14);

  const pulmonaryLeakShift = hidden.capillaryLeak * 0.018 * dt;
  const hydrostaticLeakShift = Math.max(0, hidden.leftAtrialPressure - 12) * 0.01 * dt;
  hidden.fluidOverload = clamp(hidden.fluidOverload + pulmonaryLeakShift + hydrostaticLeakShift, -400, 6000);
};
