export interface VisibleState {
  hr: number;
  bsa: number;
  strokeVolume: number;
  cardiacOutput: number;
  cardiacIndex: number;
  svr: number;
  indexedSVR: number;
  map: number;
  cvp: number;
  svv: number;
  gedi: number;
  itbv: number;
  evlw: number;
  pvpi: number;
  svo2: number;
  do2: number;
  vo2: number;
  hb: number;
  lactate: number;
  sao2: number;
  spo2: number;
  pao2: number;
  paco2: number;
  temperature: number;
  ph: number;
  hco3: number;
  be: number;
  fio2: number;
  peep: number;
  vt: number;
}

export interface HiddenPhysiology {
  contractilityLV: number;
  contractilityRV: number;
  lvCompliance: number;
  rvCompliance: number;
  venousCompliance: number;
  catecholamineSensitivity: number;
  basalTone: number;
  capillaryLeak: number;
  mitochondrialDysfunction: number;
  extractionEfficiency: number;
  microShunt: number;
  pulmonaryResistance: number;
  bloodVolume: number;
  fluidOverload: number;
  hemoglobin: number;
  rbcMass: number;
  oxygenDemandBase: number;
  sedationFactor: number;
  systemicInflammation: number;
  criticalDo2: number;
  septicCardiomyopathy: number;

  weightKg: number;

  basalSVR: number;
  basalPVR: number;
  venousResistanceBase: number;
  pulmonaryComplianceBase: number;

  ardsSeverity: number;
  atelectasis: number;
  functionalShunt: number;

  norepinephrineRate: number;
  dobutamineRate: number;
  vasopressinRate: number;

  pendingNorepinephrineRate: number;
  pendingDobutamineRate: number;
  pendingVasopressinRate: number;

  norepinephrineApplyAtSec: number;
  dobutamineApplyAtSec: number;
  vasopressinApplyAtSec: number;

  norepinephrineDrive: number;
  dobutamineDrive: number;
  vasopressinDrive: number;

  ventilatorPeep: number;
  ventilatorFio2: number;
  ventilatorVt: number;

  ventilatorPeepTarget: number;
  ventilatorFio2Target: number;
  ventilatorVtTarget: number;

  arrhythmiaBurden: number;
  vasoconstrictionBurden: number;

  rightAtrialPressure: number;
  leftAtrialPressure: number;
  pulmonaryArteryPressure: number;
  meanSystemicFillingPressure: number;
  venousReturnFlow: number;
  leftVentricularPreload: number;
  pulmonaryShuntFraction: number;
  supplyDependencyIndex: number;
  drivingPressure: number;
  pulmonaryComplianceDynamic: number;
  recentVolumeLoad: number;
  volumeEffectSite: number;
  volumeCoOffset: number;
  volumeChallengeReferenceCo: number;
  volumeChallengeActive: boolean;
  lastCalibrationTick: number;
  dominantLimiter: 'preload' | 'afterload' | 'contractility' | 'vr' | 'mixed';
  limiterLog: Array<{
    timeSec: number;
    dominant: 'preload' | 'afterload' | 'contractility' | 'vr' | 'mixed';
    preload: number;
    afterload: number;
    contractility: number;
    vr: number;
  }>;
  clampLog: string[];
}

export interface DiseaseProgression {
  leakPerHour: number;
  mitoPerHour: number;
  microShuntPerHour: number;
  inflammationPerHour: number;
  catecholamineDesensPerHour: number;
  cardiomyopathyPerHour: number;
}

export interface ProfileParameters {
  contractilityBaseline: number;
  vascularToneBaseline: number;
  pulmonaryHydrostaticSensitivity: number;
  leakBaseline: number;
  betaSensitivity: number;
  ventricularCompliance: number;
  rightLeftCoupling: number;

  pvrFloor: number;
  starlingMid: number;
  starlingSlope: number;
  preloadResponsivenessBase: number;
  preloadResponsivenessMin: number;
  preloadResponsivenessMax: number;
  plateauScale: number;
  volumeRecruitmentGain: number;
  mapDecouplingBias: number;

  dobutamineContractilityGain: number;
  dobutamineAfterloadRelief: number;
  dobutamineFlowSupportBase: number;
  dobutamineFlowSupportLowOutputGain: number;

  norepiEmaxOffset: number;
  norepiEc50Multiplier: number;
  pressorGainScale: number;
  dobutamineSvrOffset: number;

  preloadBackpressureScale: number;
  preloadCongestionToGedi: number;
  preloadArdsPenaltyScale: number;

  lvedpBase: number;
  lvedpContractilityWeight: number;
  lvedpAfterloadWeight: number;
  lvedpVolumeWeight: number;
  lvedpMin: number;
  lvedpMax: number;

  rightPressureBase: number;
  rightPressureLvedpWeight: number;
  rightPressurePvrWeight: number;
  rightPressureEvlwWeight: number;

  gediBase: number;
  gediBloodVolumeWeight: number;
  gediLvedpWeight: number;
  gediFluidWeight: number;
  gediTargetMin: number;
  gediTargetMax: number;

  evlwLeakWeight: number;
  evlwHydroWeight: number;
  evlwHydroLvedpDivisor: number;
  evlwHydroCvpDivisor: number;

  volumeResponseBloodVolumeScale: number;
  volumeResponseBloodVolumeGain: number;
  volumeResponsePmsClamp: number;
  volumeResponsePmsGain: number;
  volumeResponseCongestionScale: number;
  volumeResponseCongestionGain: number;
  volumeResponseEvlwGain: number;
  volumeResponseMaxPositive: number;
  volumeResponseMaxNegative: number;
  volumeResponseTau: number;
}

export type CaseProfile =
  | 'sepsis_advanced'
  | 'hypovolemic_hemorrhagic'
  | 'eap_cardiogenic'
  | 'eap_low_output'
  | 'tep_obstructive';

export interface CaseData {
  id: string;
  name: string;
  description: string;
  caseProfile: CaseProfile;
  profileParameters?: Partial<ProfileParameters>;
  expectedPatterns?: string;
  initialVisible: Partial<VisibleState>;
  initialHidden: HiddenPhysiology;
  hiddenRanges?: Partial<Record<keyof HiddenPhysiology, [number, number]>>;
  progression: DiseaseProgression;
  seedVariability: {
    catecholamineSensitivitySpread: number;
    extractionEfficiencySpread: number;
    cardiomyopathyChance: number;
  };
}

export interface EffectCurve {
  id: string;
  interventionType: InterventionType;
  startAtSec: number;
  latencySec: number;
  riseSec: number;
  peakSec: number;
  decaySec: number;
  durationSec: number;
  channels: Partial<EffectChannels>;
}

export interface EffectChannels {
  bloodVolume: number;
  hb: number;
}

export interface EngineEvent {
  timeSec: number;
  kind: 'info' | 'adverse';
  message: string;
}

export type FluidType = 'crystalloid';

export type InterventionType =
  | 'set_norepinephrine_rate'
  | 'set_dobutamine_rate'
  | 'set_vasopressin_rate'
  | 'give_fluid_bolus'
  | 'give_transfusion'
  | 'set_fio2'
  | 'set_peep'
  | 'set_vt';

export interface Intervention {
  type: InterventionType;
  value?: number;
  units?: number;
  volumeMl?: number;
  fluidType?: FluidType;
  targetHb?: number;
}

export interface PatientState {
  caseId: string;
  caseName: string;
  timeSec: number;
  seed: number;
  rngState: number;
  visible: VisibleState;
  hidden: HiddenPhysiology;
  profileParameters: ProfileParameters;
  progression: DiseaseProgression;
  scheduledEffects: EffectCurve[];
  engineEvents: EngineEvent[];
}
