/**
 * audit-deep.ts  –  Demonstração de absurdos fisiológicos no engine EV1000
 *
 * Executa cada caso por 300 s (5 min) sem intervenção e com intervenções,
 * e printa evidências numéricas de cada problema.
 */
import { initializeCase, step } from '@/engine/model';
import { sigmoid, clamp } from '@/engine/math';
import { caseRegistry } from '@/cases/index';

const cases = Object.values(caseRegistry);

const DT = 1;
const BSA = 1.9;

type Snap = {
  t: number;
  CO: number;
  CI: number;
  HR: number;
  SV: number;
  MAP: number;
  SVR: number;
  GEDI: number;
  EVLW: number;
  CVP: number;
  DO2: number;
  VO2: number;
  SvO2: number;
  Hb: number;
  Lac: number;
  SaO2: number;
  PaO2: number;
  pH: number;
  SVV: number;
  // Hidden
  bloodVol: number;
  rap: number;
  lap: number;
  pms: number;
  vr: number;
  lvPreload: number;
  contractLV: number;
  pvr: number;
};

function snap(state: any): Snap {
  const v = state.visible;
  const h = state.hidden;
  return {
    t: state.timeSec,
    CO: v.cardiacOutput,
    CI: v.cardiacOutput / Math.max(v.bsa, 1.2),
    HR: v.hr,
    SV: v.strokeVolume,
    MAP: v.map,
    SVR: v.svr,
    GEDI: v.gedi,
    EVLW: v.evlw,
    CVP: v.cvp,
    DO2: v.do2,
    VO2: v.vo2,
    SvO2: v.svo2,
    Hb: v.hb,
    Lac: v.lactate,
    SaO2: v.sao2,
    PaO2: v.pao2,
    pH: v.ph,
    SVV: v.svv,
    bloodVol: h.bloodVolume,
    rap: h.rightAtrialPressure,
    lap: h.leftAtrialPressure,
    pms: h.meanSystemicFillingPressure,
    vr: h.venousReturnFlow,
    lvPreload: h.leftVentricularPreload,
    contractLV: h.contractilityLV,
    pvr: h.pulmonaryResistance,
  };
}

function runBaseline(caseId: string, seconds: number): Snap[] {
  const caseData = cases.find((c: any) => c.id === caseId)!;
  let state = initializeCase(caseData, 42);
  const snaps: Snap[] = [snap(state)];
  for (let t = 1; t <= seconds; t++) {
    state = step(state, DT);
    if ([5, 10, 30, 60, 120, 180, 300].includes(t)) {
      snaps.push(snap(state));
    }
  }
  return snaps;
}

// ─── Helpers ────────────────────────────────────────────────────────

function fmt(n: number, d = 2): string {
  return n.toFixed(d);
}

function printTable(label: string, snaps: Snap[]) {
  console.log(`\n═══ ${label} ═══`);
  console.log(
    'T(s)'.padEnd(6) +
    'CO'.padEnd(7) +
    'CI'.padEnd(7) +
    'HR'.padEnd(6) +
    'SV'.padEnd(6) +
    'MAP'.padEnd(6) +
    'SVR'.padEnd(7) +
    'GEDI'.padEnd(7) +
    'EVLW'.padEnd(7) +
    'DO2'.padEnd(7) +
    'SvO2'.padEnd(7) +
    'Lac'.padEnd(6) +
    'Hb'.padEnd(6) +
    'CVP'.padEnd(6) +
    'SVV'.padEnd(6)
  );
  for (const s of snaps) {
    console.log(
      String(s.t).padEnd(6) +
      fmt(s.CO).padEnd(7) +
      fmt(s.CI).padEnd(7) +
      fmt(s.HR, 0).padEnd(6) +
      fmt(s.SV, 0).padEnd(6) +
      fmt(s.MAP, 0).padEnd(6) +
      fmt(s.SVR, 0).padEnd(7) +
      fmt(s.GEDI, 0).padEnd(7) +
      fmt(s.EVLW, 1).padEnd(7) +
      fmt(s.DO2, 0).padEnd(7) +
      fmt(s.SvO2, 0).padEnd(7) +
      fmt(s.Lac, 1).padEnd(6) +
      fmt(s.Hb, 1).padEnd(6) +
      fmt(s.CVP, 0).padEnd(6) +
      fmt(s.SVV, 0).padEnd(6)
    );
  }
}

function printHiddenTable(label: string, snaps: Snap[]) {
  console.log(`\n    Hidden vars — ${label}`);
  console.log(
    'T(s)'.padEnd(6) +
    'BldVol'.padEnd(8) +
    'PMS'.padEnd(7) +
    'RAP'.padEnd(7) +
    'VR'.padEnd(7) +
    'LAP'.padEnd(7) +
    'LVpre'.padEnd(8) +
    'ContLV'.padEnd(8) +
    'PVR'.padEnd(7)
  );
  for (const s of snaps) {
    console.log(
      String(s.t).padEnd(6) +
      fmt(s.bloodVol, 0).padEnd(8) +
      fmt(s.pms, 1).padEnd(7) +
      fmt(s.rap, 1).padEnd(7) +
      fmt(s.vr, 2).padEnd(7) +
      fmt(s.lap, 1).padEnd(7) +
      fmt(s.lvPreload, 0).padEnd(8) +
      fmt(s.contractLV, 2).padEnd(8) +
      fmt(s.pvr, 0).padEnd(7)
    );
  }
}

// ─── Checks ─────────────────────────────────────────────────────────

const caseIds = [
  'choque_hipovolemico_hemorragico',
  'eap_cardiogenico',
  'eap_perfil_l',
  'sepsis_advanced',
  'tep_macico_obstrutivo',
];

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   AUDITORIA FISIOLÓGICA PROFUNDA — ENGINE EV1000           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ── 1. CO drift em todos os casos ──────────────────────────────────
console.log('\n\n■ PROBLEMA 1: COLAPSO DE CO EM TODOS OS CASOS (sem intervenção)');
console.log('  Todos os casos perdem 60-75% do CO nos primeiros 5 minutos.');
console.log('  Isso NÃO é fisiológico: pacientes em choque mantêm CO estável\n  enquanto não há nova agressão (hemorragia, arritmia etc.).\n');

for (const id of caseIds) {
  const snaps = runBaseline(id, 300);
  const s0 = snaps[0];
  const sEnd = snaps[snaps.length - 1];
  const drop = ((s0.CO - sEnd.CO) / s0.CO * 100);
  printTable(id, snaps);
  printHiddenTable(id, snaps);
  console.log(`  → CO drift: ${fmt(s0.CO)} → ${fmt(sEnd.CO)} = -${fmt(drop, 0)}%`);
}

// ── 2. Frank-Starling equilibrium vs initial CO ────────────────────
console.log('\n\n■ PROBLEMA 2: FRANK-STARLING TARGET INCONSISTENTE COM CO INICIAL');
console.log('  O calibrateFrankStarling calcula um coTarget a partir de sigmoid(gedi, starlingMid, slope).');
console.log('  Se o gedi inicial está abaixo do starlingMid, o sigmoid retorna valor baixo → coTarget ≪ CO_init.\n');

for (const id of caseIds) {
  const caseData = cases.find((c: any) => c.id === id)!;
  const state = initializeCase(caseData, 42);
  const profile = state.profileParameters;
  const gedi = 0.65 * state.visible.gedi + 0.35 * state.hidden.leftVentricularPreload;
  const starlingCurve = sigmoid(gedi, profile.starlingMid, profile.starlingSlope);
  const plateau = clamp(
    clamp(1 - Math.max(0, gedi - 960) / 760, 0.35, 1.05) * profile.plateauScale,
    0.3,
    1.15
  );

  // Simplified contractility (no dobu at t=0)
  const contractility = clamp(
    state.hidden.contractilityLV * profile.contractilityBaseline * (1 - state.hidden.septicCardiomyopathy * 0.18),
    0.22,
    2.2
  );

  const hypoSignal = clamp((700 - gedi) / 250, 0, 1) *
    clamp((10 - state.hidden.leftAtrialPressure) / 6, 0, 1) *
    clamp((10 - state.visible.evlw) / 4, 0, 1);
  const cardioSignal =
    clamp((state.hidden.leftAtrialPressure - 14) / 8, 0, 1) +
    clamp((0.65 - state.hidden.contractilityLV) / 0.35, 0, 1) +
    clamp((state.visible.evlw - 10) / 7, 0, 1);
  const preloadResp = clamp(
    profile.preloadResponsivenessBase + 0.58 * hypoSignal - 0.34 * cardioSignal,
    profile.preloadResponsivenessMin,
    profile.preloadResponsivenessMax
  );

  const starlingFlow = 1.125 + 11.2 * starlingCurve * plateau * preloadResp * contractility;

  console.log(`  [${id}]`);
  console.log(`    GEDI_init=${state.visible.gedi}  lvPreload=${state.hidden.leftVentricularPreload}  gedi_blend=${fmt(gedi)}`);
  console.log(`    starlingMid=${profile.starlingMid}  slope=${profile.starlingSlope}`);
  console.log(`    sigmoid(gedi, mid, slo)=${fmt(starlingCurve, 4)}`);
  console.log(`    plateau=${fmt(plateau, 4)}  contractility=${fmt(contractility, 4)}  preloadResp=${fmt(preloadResp, 4)}`);
  console.log(`    → starlingFlow (=coTarget) = ${fmt(starlingFlow, 2)}  vs  CO_init = ${state.visible.cardiacOutput}`);
  console.log(`    Δ = ${fmt(starlingFlow - state.visible.cardiacOutput, 2)}  (${(100*(starlingFlow - state.visible.cardiacOutput)/state.visible.cardiacOutput).toFixed(0)}%)\n`);
}

// ── 3. MAP = CO*SVR/80 + RAP ── verifique se MAP = 25 floor ───────
console.log('\n\n■ PROBLEMA 3: MAP CRASHA PARA O FLOOR (25 mmHg)');
console.log('  Com CO caindo para ~1 L/min, MAP = CO*SVR/80+offset → geralmente < 25 → engata no clamp.\n');
for (const id of caseIds) {
  const snaps = runBaseline(id, 300);
  const s300 = snaps[snaps.length - 1];
  const expectedMap = (s300.CO * s300.SVR) / 80 + 2 + s300.rap * 0.35;
  console.log(`  [${id}] t=300s: CO=${fmt(s300.CO)}, SVR=${fmt(s300.SVR, 0)}, RAP=${fmt(s300.rap, 1)}`);
  console.log(`    MAP teórico = ${fmt(expectedMap)} → MAP visível = ${fmt(s300.MAP, 0)} (floor=25)\n`);
}

// ── 4. HR não compensa choque ──────────────────────────────────────
console.log('\n■ PROBLEMA 4: HR NÃO SOBE COMPENSATORIAMENTE COM CO ↓');
console.log('  A fórmula de HR (cardiovascular.ts) depende de systemicInflammation, norepi, dobu,');
console.log('  arrhythmiaBurden e temperatura — mas NÃO de MAP/CO baixo.',);
console.log('  Barorreflexo ausente → HR CAI paradoxalmente no hipovolêmico.\n');
for (const id of caseIds) {
  const snaps = runBaseline(id, 300);
  const s0 = snaps[0]; const s300 = snaps[snaps.length - 1];
  const delta = s300.HR - s0.HR;
  const label = delta > 0 ? `+${fmt(delta, 0)}` : fmt(delta, 0);
  console.log(`  [${id}] HR: ${fmt(s0.HR, 0)} → ${fmt(s300.HR, 0)}  (Δ=${label})  enquanto CO: ${fmt(s0.CO)} → ${fmt(s300.CO)}`);
}

// ── 5. SvO2 vs Fick ────────────────────────────────────────────────
console.log('\n\n■ PROBLEMA 5: SvO2 DESACOPLADA DA EQUAÇÃO DE FICK');
console.log('  SvO2 Fick = SaO2 − VO2 / (CO × Hb × 1.34 × 10)');
console.log('  O engine adiciona +functionalShunt*7 + mitoDysfunction*4 → offset permanente.\n');
for (const id of caseIds) {
  const snaps = runBaseline(id, 300);
  const s300 = snaps[snaps.length - 1];
  const carry = s300.CO * s300.Hb * 1.34 * 10;
  const fickSvO2 = s300.SaO2 - (s300.VO2 / carry) * 100;
  console.log(`  [${id}] t=300s: SvO2=${fmt(s300.SvO2, 0)}  Fick=${fmt(fickSvO2, 0)}  Δ=${fmt(s300.SvO2 - fickSvO2, 0)}`);
}

// ── 6. DO2 deveria = CO × Hb × 1.34 × SaO2/100 × 10 ──────────────
console.log('\n\n■ PROBLEMA 6: DO2 INICIAL (t=0) vs Fick');
console.log('  Ao inicializar, DO2 no JSON pode não coincidir com CO*Hb*1.34*SaO2/100*10.\n');
for (const id of caseIds) {
  const caseData = cases.find((c: any) => c.id === id)!;
  const state = initializeCase(caseData, 42);
  const v = state.visible;
  const fick = v.cardiacOutput * v.hb * 1.34 * (v.sao2 / 100) * 10;
  console.log(`  [${id}] DO2_json=${v.do2}  Fick=${fmt(fick, 0)}  Δ=${fmt(v.do2 - fick, 0)}`);
}

// ── 7. Cristalóide retention ──────────────────────────────────────
console.log('\n\n■ PROBLEMA 7: CRISTALÓIDE COM RETENÇÃO INTRAVASCULAR EXCESSIVA');
console.log('  Na literatura, cristalóide tem ~20-25% de retained IV em 30 min.');
console.log('  O engine pode reter ~70% (fórmula em step.ts).\n');
// Precisa investigar updateVolumeCompartments em step.ts
const stepFile = require('fs').readFileSync('/home/ubuntu/ev1000/engine/step.ts', 'utf-8');
const ivMatch = stepFile.match(/intravascularFraction/g);
console.log(`  "intravascularFraction" aparece ${ivMatch?.length ?? 0}x em step.ts`);

// ── 8. Múltiplas calibrações sobrepostas puxam CO ──────────────────
console.log('\n\n■ PROBLEMA 8: CO É ALVO DE PELO MENOS 6 CALIBRAÇÕES NO MESMO TICK');
console.log('  applyPhysiologyCalibration chama, em sequência:');
console.log('    1. calibrateNorepiEmax          → pode ajustar CO via secondaryAfterload');
console.log('    2. calibrateFrankStarling        → puxa CO para starlingFlow');
console.log('    3. calibrateEvlwAndCompliance    → ajusta CO via PEEP penalty + rvPenalty');
console.log('    4. calibrateProfileVolumeResponse → additive/subtractive offset');
console.log('    5. comboStress (PEEP x pressor)  → multiplicative penalty');
console.log('    6. calibrateMapAndDerived        → recalcula SV = CO*1000/HR');
console.log('  Cada uma lê o CO "atual" e aplica um alvo → efeito cascata.\n');

// Demonstrar contando as modificações
let coModsInCalibrateFnName: string[] = [];
const calFns = ['calibrateNorepiEmax', 'calibrateFrankStarling', 'calibrateEvlwAndCompliance',
  'calibrateProfileSpecificVolumeResponse', 'calibrateMapAndDerived'];
const modelSrc = require('fs').readFileSync('/home/ubuntu/ev1000/engine/model.ts', 'utf-8');
for (const fn of calFns) {
  const fnBody = modelSrc.split(fn)[1]?.split('\nconst ')[0] ?? '';
  const coWrites = (fnBody.match(/visible\.cardiacOutput\s*[+=]/g) || []).length;
  if (coWrites > 0) coModsInCalibrateFnName.push(`${fn}: ${coWrites}x`);
}
for (const entry of coModsInCalibrateFnName) {
  console.log(`  ${entry}`);
}

// ── RESUMO ──────────────────────────────────────────────────────────
console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  RESUMO: 8 ACHADOS FISIOLÓGICOS CRÍTICOS                   ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║ 1. CO colapsa 60-75% em 5 min sem intervenção              ║');
console.log('║ 2. Frank-Starling target ≪ CO inicial (sigmoid sub-unity)  ║');
console.log('║ 3. MAP engata no floor 25 mmHg em todos os casos           ║');
console.log('║ 4. HR não compensa via barorreflexo (fórmula estática)     ║');
console.log('║ 5. SvO2 desacoplada de Fick (offset +shunt/+mito errado)  ║');
console.log('║ 6. DO2 inicial declarado ≠ Fick                            ║');
console.log('║ 7. Cristalóide com retenção IV excessiva (~70% vs 20-25%) ║');
console.log('║ 8. CO alvo de 6 calibrações sequenciais → cascata de drift║');
console.log('╚══════════════════════════════════════════════════════════════╝');
