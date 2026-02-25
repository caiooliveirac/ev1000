import { clamp, sigmoid } from '@/engine/math';
import { CouplingState } from '@/engine/coupling';
import { PatientState } from '@/engine/types';

export const updateVentilation = (
  state: PatientState,
  coupling: CouplingState,
  dt: number
): void => {
  const hidden = state.hidden;

  hidden.ventilatorFio2 += (hidden.ventilatorFio2Target - hidden.ventilatorFio2) * (dt / 20);
  hidden.ventilatorPeep += (hidden.ventilatorPeepTarget - hidden.ventilatorPeep) * (dt / 55);
  hidden.ventilatorVt += (hidden.ventilatorVtTarget - hidden.ventilatorVt) * (dt / 50);

  hidden.ventilatorFio2 = clamp(hidden.ventilatorFio2, 0.21, 1);
  hidden.ventilatorPeep = clamp(hidden.ventilatorPeep, 5, 20);
  hidden.ventilatorVt = clamp(hidden.ventilatorVt, 280, 750);

  const vtPerKg = hidden.ventilatorVt / Math.max(hidden.weightKg, 40);
  const edemaPenalty = 1 + Math.max(0, coupling.evlw - 7) * 0.08;
  const ardsPenalty = 1 + hidden.ardsSeverity * 1.2;
  const vtStressPenalty = 1 + Math.max(0, vtPerKg - 6.5) * 0.12;

  const compliance = clamp(
    hidden.pulmonaryComplianceBase / (edemaPenalty * ardsPenalty * vtStressPenalty),
    10,
    95
  );

  const drivingPressure = clamp(hidden.ventilatorVt / Math.max(compliance, 8), 4, 45);

  const peepIntrathoracic = (hidden.ventilatorPeep - 5) * 0.55;
  const dynamicIntrathoracic = drivingPressure * 0.22;
  const stiffnessFactor = sigmoid(hidden.ardsSeverity, 0.4, 0.25);

  coupling.pulmonaryCompliance = compliance;
  coupling.drivingPressure = drivingPressure;
  coupling.intrathoracicPressure = clamp(
    3.8 + peepIntrathoracic + dynamicIntrathoracic * (0.7 + 0.3 * stiffnessFactor),
    2,
    28
  );

  hidden.drivingPressure = coupling.drivingPressure;
  hidden.pulmonaryComplianceDynamic = coupling.pulmonaryCompliance;
};
