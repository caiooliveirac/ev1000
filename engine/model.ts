/**
 * model.ts — Public facade for the engine.
 *
 * All implementation has been split into focused modules:
 *   - defaults.ts      — baseline values, normalization, shared helpers
 *   - calibration.ts   — 10 calibration overlay functions + orchestrator
 *   - initCase.ts      — case initialisation with equilibrium probing
 *   - interventions.ts — user intervention handling
 *
 * This file re-exports the public API so that all existing imports
 *   import { initializeCase, step, applyIntervention } from '@/engine/model'
 * continue to work unchanged.
 */
import { runCoupledPass, step as coupledStep } from '@/engine/step';
import { PatientState } from '@/engine/types';
import { applyPhysiologyCalibration } from '@/engine/calibration';

// Re-export public symbols from sub-modules
export { initializeCase } from '@/engine/initCase';
export { applyIntervention } from '@/engine/interventions';

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
