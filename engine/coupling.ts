import { HiddenPhysiology, VisibleState } from '@/engine/types';

export interface CouplingState {
  intrathoracicPressure: number;
  pulmonaryCompliance: number;
  drivingPressure: number;

  shuntFraction: number;
  vqMismatch: number;
  pao2: number;
  paco2: number;
  sao2Fraction: number;

  pms: number;
  rap: number;
  venousResistance: number;
  venousReturn: number;

  rvOutput: number;
  rvStrokeVolume: number;
  pvr: number;
  pulmonaryFlow: number;

  lvOutput: number;
  lvStrokeVolume: number;
  lvPreloadIndex: number;
  svr: number;

  hr: number;
  map: number;
  cvp: number;

  gedi: number;
  itbv: number;
  evlw: number;
  pvpi: number;

  do2: number;
  vo2: number;
  svo2: number;
  lactate: number;

  temperature: number;
  ph: number;
  hco3: number;
  be: number;

  supplyDependencyIndex: number;

  // Anchor / reference values for ratio-based coupled-pass stabilisation.
  // "anchor" = initial coupling value (from case init); "ref" = first-tick
  // raw biophysical output.  ratio = rawNow / ref; target = anchor * ratio.
  // -1 means "not yet initialised" (lazy-filled on first tick).
  anchorPms: number;
  refPmsTarget: number;
  anchorVR: number;
  refVRRaw: number;
  anchorRV: number;
  refRVRaw: number;
  anchorLV: number;
  refLVRaw: number;
}

export const buildInitialCoupling = (
  hidden: HiddenPhysiology,
  visible: VisibleState
): CouplingState => {
  return {
    intrathoracicPressure: 6,
    pulmonaryCompliance: hidden.pulmonaryComplianceDynamic || hidden.pulmonaryComplianceBase,
    drivingPressure: hidden.drivingPressure || 12,

    shuntFraction: hidden.pulmonaryShuntFraction || 0.2,
    vqMismatch: 0.2,
    pao2: visible.pao2,
    paco2: visible.paco2,
    sao2Fraction: Math.max(0.01, visible.sao2 / 100),

    pms: hidden.meanSystemicFillingPressure || 11,
    rap: hidden.rightAtrialPressure || visible.cvp,
    venousResistance: hidden.venousResistanceBase,
    venousReturn: hidden.venousReturnFlow || visible.cardiacOutput,

    rvOutput: visible.cardiacOutput,
    rvStrokeVolume: visible.strokeVolume,
    pvr: hidden.pulmonaryResistance,
    pulmonaryFlow: visible.cardiacOutput,

    lvOutput: visible.cardiacOutput,
    lvStrokeVolume: visible.strokeVolume,
    lvPreloadIndex: hidden.leftVentricularPreload || visible.gedi,
    svr: visible.svr,

    hr: visible.hr,
    map: visible.map,
    cvp: visible.cvp,

    gedi: visible.gedi,
    itbv: visible.itbv,
    evlw: visible.evlw,
    pvpi: visible.pvpi,

    do2: visible.do2,
    vo2: visible.vo2,
    svo2: visible.svo2,
    lactate: visible.lactate,

    temperature: visible.temperature,
    ph: visible.ph,
    hco3: visible.hco3,
    be: visible.be,

    supplyDependencyIndex: hidden.supplyDependencyIndex || 0.2,

    // Anchors (initial coupling values) – set now
    anchorPms: hidden.meanSystemicFillingPressure || 11,
    anchorVR: hidden.venousReturnFlow || visible.cardiacOutput,
    anchorRV: visible.cardiacOutput,
    anchorLV: visible.cardiacOutput,
    // References (first-tick raw biophysical outputs) – lazy-initialised
    refPmsTarget: -1,
    refVRRaw: -1,
    refRVRaw: -1,
    refLVRaw: -1,
  };
};
