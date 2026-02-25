import { clamp, sigmoid } from '@/engine/math';
import { CouplingState } from '@/engine/coupling';
import { PatientState } from '@/engine/types';

export const updateMicrocirculation = (
  state: PatientState,
  coupling: CouplingState,
  dt: number
): void => {
  const hidden = state.hidden;

  const do2 = coupling.lvOutput * hidden.hemoglobin * 1.34 * coupling.sao2Fraction * 10;

  const demand =
    hidden.oxygenDemandBase *
    (1 - hidden.sedationFactor) *
    (1 + hidden.systemicInflammation * 0.22) *
    (1 + (coupling.temperature - 37) * 0.08) *
    (1 + hidden.arrhythmiaBurden * 0.12);

  const criticalDo2 = hidden.criticalDo2 * (1 + hidden.mitochondrialDysfunction * 0.22);
  const do2Ratio = do2 / Math.max(criticalDo2, 80);
  const supplyTransition = sigmoid(do2Ratio, 1, 0.14);

  const vo2 =
    demand * (0.3 + 0.7 * supplyTransition) * (1 - hidden.mitochondrialDysfunction * 0.25);

  const extractionTarget = clamp(
    0.86 -
      hidden.mitochondrialDysfunction * 0.18 -
      hidden.functionalShunt * 0.35 -
      hidden.vasoconstrictionBurden * 0.16,
    0.25,
    0.92
  );
  hidden.extractionEfficiency += (extractionTarget - hidden.extractionEfficiency) * (dt / 500);
  hidden.extractionEfficiency = clamp(hidden.extractionEfficiency, 0.2, 0.95);

  const extractionDynamic = clamp(
    hidden.extractionEfficiency * (1 - hidden.microShunt * 0.35),
    0.15,
    1
  );

  const oxygenCarrying = Math.max(coupling.lvOutput * hidden.hemoglobin * 1.34 * 10, 0.1);
  const extractionGradient = (vo2 * extractionDynamic) / oxygenCarrying;
  // Fick-based SvO2: SaO2 − VO2/(CO×Hb×1.34×10).
  // Venous admixture (shunt) mixes arterial blood into the venous sample,
  // raising measured SvO2 slightly: SvO2_measured = (1-shunt)*SvO2_true + shunt*SaO2.
  const svo2True = coupling.sao2Fraction * 100 - extractionGradient * 100;
  const shunt = clamp(hidden.functionalShunt, 0, 0.4);
  const svo2 = clamp(
    (1 - shunt) * svo2True + shunt * coupling.sao2Fraction * 100,
    25,
    95
  );

  const do2Debt = clamp((criticalDo2 - do2) / Math.max(criticalDo2, 80), 0, 2.5);
  const extractionDebt = clamp((0.72 - hidden.extractionEfficiency) / 0.72, 0, 2);

  const lactateTarget =
    1.2 +
    do2Debt * 6.3 +
    extractionDebt * 3.2 +
    hidden.mitochondrialDysfunction * 1.9 +
    hidden.vasoconstrictionBurden * 1.4;

  const riseTau = 900;
  const fallTau = 2500;
  const tau = lactateTarget > coupling.lactate ? riseTau : fallTau;
  const lactate = clamp(coupling.lactate + (lactateTarget - coupling.lactate) * (dt / tau), 0.6, 20);

  const hco3 = clamp(24 - (lactate - 1.2) * 1.6, 8, 34);
  const ph = clamp(6.1 + Math.log10(Math.max(hco3, 1) / (0.03 * coupling.paco2)), 6.8, 7.6);
  const be = clamp((hco3 - 24) + (ph - 7.4) * 10, -30, 15);

  coupling.do2 = do2;
  coupling.vo2 = vo2;
  coupling.svo2 = svo2;
  coupling.lactate = lactate;
  coupling.hco3 = hco3;
  coupling.ph = ph;
  coupling.be = be;
  coupling.supplyDependencyIndex = 1 - supplyTransition;

  hidden.supplyDependencyIndex = coupling.supplyDependencyIndex;
};
