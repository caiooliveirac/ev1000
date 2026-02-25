import { clamp, hillSaturation, sigmoid } from '@/engine/math';
import { CouplingState } from '@/engine/coupling';
import { PatientState } from '@/engine/types';

export const updateGasExchange = (
  state: PatientState,
  coupling: CouplingState,
  dt: number
): void => {
  const hidden = state.hidden;

  const edemaComponent = Math.max(0, coupling.evlw - 7) * 0.018;
  const ardsComponent = hidden.ardsSeverity * 0.25;
  const atelectasisComponent = hidden.atelectasis * 0.22;
  const microShuntComponent = hidden.microShunt * 0.18;

  const recruitment = sigmoid(hidden.ventilatorPeep, 9.5, 1.8) * (0.22 + hidden.ardsSeverity * 0.08);
  const overdistensionPenalty = Math.max(0, hidden.ventilatorPeep - 14) * 0.015;

  const shuntTarget = clamp(
    0.08 +
      hidden.functionalShunt +
      edemaComponent +
      ardsComponent +
      atelectasisComponent +
      microShuntComponent -
      recruitment +
      overdistensionPenalty,
    0.03,
    0.8
  );

  coupling.shuntFraction += (shuntTarget - coupling.shuntFraction) * (dt / 40);
  coupling.shuntFraction = clamp(coupling.shuntFraction, 0.03, 0.8);

  const deadSpaceTarget = clamp(
    0.08 + hidden.ardsSeverity * 0.18 + Math.max(0, coupling.drivingPressure - 14) * 0.012,
    0.05,
    0.6
  );
  coupling.vqMismatch = clamp(0.6 * coupling.vqMismatch + 0.4 * deadSpaceTarget, 0.04, 0.7);

  const fio2 = hidden.ventilatorFio2;
  const recruitmentBonus = sigmoid(hidden.ventilatorPeep, 10, 2) * (1 - coupling.shuntFraction) * 45;

  const pao2Target =
    fio2 * 580 * (1 - coupling.shuntFraction) * (1 - 0.45 * coupling.vqMismatch) + recruitmentBonus;
  coupling.pao2 = clamp(coupling.pao2 + (pao2Target - coupling.pao2) * (dt / 35), 35, 520);

  const alveolarVentilationFactor = clamp(
    (hidden.ventilatorVt / Math.max(hidden.weightKg, 45) - 4.5) / 3,
    -0.5,
    1.2
  );

  const paco2Target =
    38 + coupling.vqMismatch * 18 + Math.max(0, coupling.shuntFraction - 0.25) * 20 - alveolarVentilationFactor * 10;
  coupling.paco2 = clamp(coupling.paco2 + (paco2Target - coupling.paco2) * (dt / 45), 22, 100);

  const p50Shift = 26.8 * (1 + (coupling.temperature - 37) * 0.02);
  coupling.sao2Fraction = clamp(hillSaturation(coupling.pao2, p50Shift), 0.55, 1);

  hidden.functionalShunt += (hidden.microShunt * 0.6 + hidden.mitochondrialDysfunction * 0.05 - hidden.functionalShunt) * (dt / 1200);
  hidden.functionalShunt = clamp(hidden.functionalShunt, 0.02, 0.35);

  hidden.pulmonaryShuntFraction = coupling.shuntFraction;
};
