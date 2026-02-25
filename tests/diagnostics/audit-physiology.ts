/**
 * Audit script – runs every case through baseline + common interventions
 * and prints a table of key physiological variables at t=0, 3min, 5min, 10min.
 *
 * Usage: npx tsx tests/audit-physiology.ts
 */

import sepsisCase from '@/cases/sepsis-advanced.json';
import eapCardiogenicCase from '@/cases/eap-cardiogenico.json';
import hypovolemicCase from '@/cases/choque-hipovolemico-hemorragico.json';
import tepCase from '@/cases/tep-macico-obstrutivo.json';
import eapPerfilLCase from '@/cases/eap-perfil-l.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, Intervention, PatientState } from '@/engine/types';

const runFor = (state: PatientState, seconds: number): PatientState => {
  let s = state;
  for (let i = 0; i < seconds; i++) s = step(s, 1);
  return s;
};

const snap = (s: PatientState) => {
  const v = s.visible;
  const h = s.hidden;
  const bsa = Math.max(v.bsa, 1.2);
  const hr = Math.max(v.hr, 1);
  const sv = (v.cardiacOutput * 1000) / hr;
  const ci = v.cardiacOutput / bsa;
  const do2i = v.do2 / bsa;
  const cpo = (v.map * v.cardiacOutput) / 451;
  const oer = v.vo2 / Math.max(v.do2, 1);
  return {
    t: Math.round(s.timeSec),
    CO: +v.cardiacOutput.toFixed(2),
    CI: +ci.toFixed(2),
    SV: +sv.toFixed(1),
    HR: +v.hr.toFixed(0),
    MAP: +v.map.toFixed(0),
    SVR: +v.svr.toFixed(0),
    CVP: +v.cvp.toFixed(1),
    GEDI: +v.gedi.toFixed(0),
    SVV: +v.svv.toFixed(1),
    EVLW: +v.evlw.toFixed(1),
    PVPI: +v.pvpi.toFixed(2),
    DO2: +v.do2.toFixed(0),
    DO2i: +do2i.toFixed(0),
    VO2: +v.vo2.toFixed(0),
    SvO2: +v.svo2.toFixed(1),
    Lac: +v.lactate.toFixed(2),
    Hb: +v.hb.toFixed(1),
    SaO2: +v.sao2.toFixed(1),
    PaO2: +v.pao2.toFixed(0),
    PaCO2: +v.paco2.toFixed(0),
    pH: +v.ph.toFixed(3),
    HCO3: +v.hco3.toFixed(1),
    CPO: +cpo.toFixed(2),
    OER: +oer.toFixed(3),
    LAP: +h.leftAtrialPressure.toFixed(1),
    PVR: +h.pulmonaryResistance.toFixed(0),
    BV: +h.bloodVolume.toFixed(0),
    Pms: +h.meanSystemicFillingPressure.toFixed(1),
    VR: +h.venousReturnFlow.toFixed(2),
    LVPrel: +h.leftVentricularPreload.toFixed(0),
    ContrLV: +h.contractilityLV.toFixed(3),
    ContrRV: +h.contractilityRV.toFixed(3),
    Leak: +h.capillaryLeak.toFixed(3),
    FluidOvl: +h.fluidOverload.toFixed(0),
  };
};

interface Scenario {
  label: string;
  caseData: CaseData;
  seed: number;
  interventions: Intervention[];
  interventionDelaySec: number; // apply interventions after this many seconds
}

const scenarios: Scenario[] = [
  // === BASELINE (no intervention) ===
  { label: 'Hipo – baseline', caseData: hypovolemicCase as CaseData, seed: 42, interventions: [], interventionDelaySec: 0 },
  { label: 'EAP-C – baseline', caseData: eapCardiogenicCase as CaseData, seed: 42, interventions: [], interventionDelaySec: 0 },
  { label: 'EAP-L – baseline', caseData: eapPerfilLCase as CaseData, seed: 42, interventions: [], interventionDelaySec: 0 },
  { label: 'Sepsis – baseline', caseData: sepsisCase as CaseData, seed: 42, interventions: [], interventionDelaySec: 0 },
  { label: 'TEP – baseline', caseData: tepCase as CaseData, seed: 42, interventions: [], interventionDelaySec: 0 },

  // === VOLUME 1000mL at t=0 ===
  { label: 'Hipo + 1L SF', caseData: hypovolemicCase as CaseData, seed: 42, interventions: [{ type: 'give_fluid_bolus', volumeMl: 1000 }], interventionDelaySec: 0 },
  { label: 'EAP-C + 1L SF', caseData: eapCardiogenicCase as CaseData, seed: 42, interventions: [{ type: 'give_fluid_bolus', volumeMl: 1000 }], interventionDelaySec: 0 },
  { label: 'Sepsis + 1L SF', caseData: sepsisCase as CaseData, seed: 42, interventions: [{ type: 'give_fluid_bolus', volumeMl: 1000 }], interventionDelaySec: 0 },

  // === NORAD 0.2 mcg/kg/min ===
  { label: 'Hipo + Norad 0.2', caseData: hypovolemicCase as CaseData, seed: 42, interventions: [{ type: 'set_norepinephrine_rate', value: 0.2 }], interventionDelaySec: 0 },
  { label: 'Sepsis + Norad 0.2', caseData: sepsisCase as CaseData, seed: 42, interventions: [{ type: 'set_norepinephrine_rate', value: 0.2 }], interventionDelaySec: 0 },

  // === DOBUTAMINA 10 mcg/kg/min ===
  { label: 'EAP-C + Dobu 10', caseData: eapCardiogenicCase as CaseData, seed: 42, interventions: [{ type: 'set_dobutamine_rate', value: 10 }], interventionDelaySec: 0 },
  { label: 'EAP-L + Dobu 10', caseData: eapPerfilLCase as CaseData, seed: 42, interventions: [{ type: 'set_dobutamine_rate', value: 10 }], interventionDelaySec: 0 },

  // === COMBINED: volume + norad (sepsis) ===
  { label: 'Sepsis + 1L + Norad 0.15', caseData: sepsisCase as CaseData, seed: 42, interventions: [
    { type: 'give_fluid_bolus', volumeMl: 1000 },
    { type: 'set_norepinephrine_rate', value: 0.15 },
  ], interventionDelaySec: 0 },

  // === TRANSFUSION (hypovolemic) ===
  { label: 'Hipo + Transfusion 2U', caseData: hypovolemicCase as CaseData, seed: 42, interventions: [{ type: 'give_transfusion', units: 2 }], interventionDelaySec: 0 },

  // === HIGH PEEP ===
  { label: 'TEP + PEEP 16', caseData: tepCase as CaseData, seed: 42, interventions: [{ type: 'set_peep', value: 16 }], interventionDelaySec: 0 },
  { label: 'EAP-C + PEEP 14', caseData: eapCardiogenicCase as CaseData, seed: 42, interventions: [{ type: 'set_peep', value: 14 }], interventionDelaySec: 0 },
];

const timepoints = [0, 60, 180, 300, 600]; // seconds

console.log('\n========== AUDITORIA FISIOLÓGICA COMPLETA ==========\n');

for (const sc of scenarios) {
  console.log(`\n--- ${sc.label} ---`);
  let state = initializeCase(sc.caseData, sc.seed);

  // Apply interventions
  if (sc.interventionDelaySec === 0) {
    for (const iv of sc.interventions) {
      state = applyIntervention(state, iv);
    }
  }

  const rows: ReturnType<typeof snap>[] = [];
  let currentSec = 0;

  for (const tp of timepoints) {
    if (tp > currentSec) {
      state = runFor(state, tp - currentSec);
      currentSec = tp;
    }
    rows.push(snap(state));
  }

  console.table(rows);
}

// === SPECIFIC CHECKS ===
console.log('\n\n========== VERIFICAÇÕES ESPECÍFICAS ==========\n');

// 1. Check SV × HR = CO consistency at t=0
console.log('--- SV × HR vs CO declarado (t=0) ---');
const cases = [
  { name: 'Hipo', data: hypovolemicCase as CaseData },
  { name: 'EAP-C', data: eapCardiogenicCase as CaseData },
  { name: 'EAP-L', data: eapPerfilLCase as CaseData },
  { name: 'Sepsis', data: sepsisCase as CaseData },
  { name: 'TEP', data: tepCase as CaseData },
];
for (const c of cases) {
  const iv = c.data.initialVisible;
  const svXhr = ((iv.strokeVolume ?? 0) * (iv.hr ?? 0)) / 1000;
  const declared = iv.cardiacOutput;
  const diff = Math.abs(svXhr - declared);
  console.log(`  ${c.name}: SV=${iv.strokeVolume} × HR=${iv.hr} = ${svXhr.toFixed(2)} L/min vs CO=${declared} → Δ=${diff.toFixed(2)} ${diff > 0.15 ? '⚠️ INCONSISTENT' : '✓'}`);
}

// 2. Check DO2 = CO × Hb × 1.34 × SaO2/100 × 10 at t=0
console.log('\n--- DO2 calculado vs declarado (t=0) ---');
for (const c of cases) {
  const iv = c.data.initialVisible;
  const hb = iv.hb ?? c.data.initialHidden.hemoglobin;
  const sao2 = iv.sao2 ?? 97;
  const calcDo2 = iv.cardiacOutput * hb * 1.34 * (sao2 / 100) * 10;
  const declared = iv.do2;
  const diff = Math.abs(calcDo2 - declared);
  console.log(`  ${c.name}: CO=${iv.cardiacOutput} × Hb=${hb} × 1.34 × SaO2=${sao2}% × 10 = ${calcDo2.toFixed(0)} vs DO2=${declared} → Δ=${diff.toFixed(0)} ${diff > 30 ? '⚠️ INCONSISTENT' : '✓'}`);
}

// 3. Check MAP ≈ CO × SVR / 80 + offset
console.log('\n--- MAP vs CO×SVR/80 (t=0) ---');
for (const c of cases) {
  const iv = c.data.initialVisible;
  const calcMap = (iv.cardiacOutput * iv.svr) / 80 + 3;
  const declared = iv.map;
  const diff = Math.abs(calcMap - declared);
  console.log(`  ${c.name}: CO×SVR/80+3 = ${calcMap.toFixed(0)} vs MAP=${declared} → Δ=${diff.toFixed(0)} ${diff > 8 ? '⚠️ INCONSISTENT' : '✓'}`);
}

// 4. Check ITBV = GEDI × 1.24 consistency
console.log('\n--- ITBV vs GEDI × 1.24 (t=0) ---');
for (const c of cases) {
  const iv = c.data.initialVisible;
  const calcItbv = iv.gedi * 1.24;
  const declared = iv.itbv;
  const diff = Math.abs(calcItbv - declared);
  console.log(`  ${c.name}: GEDI=${iv.gedi} × 1.24 = ${calcItbv.toFixed(0)} vs ITBV=${declared} → Δ=${diff.toFixed(0)} ${diff > 10 ? '⚠️ INCONSISTENT' : '✓'}`);
}

// 5. Check CI = CO / BSA
console.log('\n--- CI vs CO/BSA (t=0) ---');
for (const c of cases) {
  const iv = c.data.initialVisible;
  const calcCi = iv.cardiacOutput / iv.bsa;
  const declared = iv.cardiacIndex;
  const diff = Math.abs(calcCi - declared);
  console.log(`  ${c.name}: CO=${iv.cardiacOutput}/BSA=${iv.bsa} = ${calcCi.toFixed(2)} vs CI=${declared} → Δ=${diff.toFixed(2)} ${diff > 0.05 ? '⚠️ INCONSISTENT' : '✓'}`);
}

// 6. OER and SvO2 sanity
console.log('\n--- OER e SvO2 em 5min (baseline) ---');
for (const c of cases) {
  let state = initializeCase(c.data, 42);
  state = runFor(state, 300);
  const v = state.visible;
  const oer = v.vo2 / Math.max(v.do2, 1);
  const expectedSvO2 = v.sao2 - oer * 100; // simplified Fick
  console.log(`  ${c.name}: SvO2=${v.svo2.toFixed(1)}%, OER=${(oer*100).toFixed(1)}%, SaO2-OER×100=${expectedSvO2.toFixed(1)} (Δ=${Math.abs(v.svo2 - expectedSvO2).toFixed(1)}) ${Math.abs(v.svo2 - expectedSvO2) > 12 ? '⚠️ SvO2 MISMATCH' : '✓'}`);
  console.log(`         CO=${v.cardiacOutput.toFixed(2)} CI=${(v.cardiacOutput/v.bsa).toFixed(2)} DO2=${v.do2.toFixed(0)} DO2i=${(v.do2/v.bsa).toFixed(0)} Lac=${v.lactate.toFixed(2)}`);
}

// 7. Check CO collapse over time
console.log('\n--- CO drift de t=0 a t=5min (baseline, sem intervenção) ---');
for (const c of cases) {
  const s0 = initializeCase(c.data, 42);
  const s5 = runFor(s0, 300);
  const coDrop = s0.visible.cardiacOutput - s5.visible.cardiacOutput;
  const pctDrop = (coDrop / s0.visible.cardiacOutput) * 100;
  console.log(`  ${c.name}: CO t=0: ${s0.visible.cardiacOutput.toFixed(2)} → t=5min: ${s5.visible.cardiacOutput.toFixed(2)} (Δ=${coDrop.toFixed(2)}, ${pctDrop.toFixed(1)}%) ${Math.abs(pctDrop) > 25 ? '⚠️ EXCESSIVE DRIFT' : '✓'}`);
}

// 8. Effective intravascular fraction of crystalloid
console.log('\n--- Fração intravascular efetiva de 1L cristaloide em 5min ---');
for (const c of cases) {
  const base = runFor(initializeCase(c.data, 42), 120);
  const bolus = applyIntervention(JSON.parse(JSON.stringify(base)), { type: 'give_fluid_bolus', volumeMl: 1000 });
  const after = runFor(bolus, 300);
  const baseCont = runFor(base, 300);
  const deltaBV = after.hidden.bloodVolume - baseCont.hidden.bloodVolume;
  const deltaFO = after.hidden.fluidOverload - baseCont.hidden.fluidOverload;
  const ivFrac = deltaBV / (deltaBV + deltaFO + 0.01);
  console.log(`  ${c.name}: ΔBV=${deltaBV.toFixed(0)} mL, ΔFO=${deltaFO.toFixed(0)} mL, IV fraction=${(ivFrac*100).toFixed(1)}% ${ivFrac < 0.15 ? '⚠️ TOO LOW' : ivFrac > 0.55 ? '⚠️ TOO HIGH' : '✓'}`);
}
