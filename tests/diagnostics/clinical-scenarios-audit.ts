/**
 * Clinical Scenarios Audit
 * 
 * Tests each clinical case with systematic interventions:
 * 1. Baseline (30s evolução livre)
 * 2. Volume (500ml bolus) → espera 60s → avalia
 * 3. Reset → baseline
 * 4. Norepinefrina 0.1 mcg/kg/min → espera 60s → sobe para 0.3 → espera 60s
 * 5. Reset → baseline
 * 6. Dobutamina 5 mcg/kg/min → espera 60s → sobe para 10 → espera 60s
 * 7. Reset → baseline
 * 8. Vasopressina 0.03 U/min → espera 60s
 */

import { createSimulation, tickSimulation, runIntervention } from '@/sim/simulation';
import { caseRegistry } from '@/cases';

interface Snapshot {
  label: string;
  map: number;
  co: number;
  hr: number;
  svr: number;
  cvp: number;
  svv: number;
  gedi: number;
  evlw: number;
  svo2: number;
  lactate: number;
  do2: number;
  pao2: number;
  ph: number;
  bv: number;
}

function snap(sim: ReturnType<typeof createSimulation>, label: string): Snapshot {
  const v = sim.patient.visible;
  const h = sim.patient.hidden;
  return {
    label,
    map: Math.round(v.map),
    co: +v.cardiacOutput.toFixed(2),
    hr: Math.round(v.hr),
    svr: Math.round(v.svr),
    cvp: Math.round(v.cvp),
    svv: Math.round(v.svv),
    gedi: Math.round(v.gedi),
    evlw: +v.evlw.toFixed(1),
    svo2: Math.round(v.svo2),
    lactate: +v.lactate.toFixed(2),
    do2: Math.round(v.do2),
    pao2: Math.round(v.pao2),
    ph: +v.ph.toFixed(2),
    bv: Math.round(h.bloodVolume),
  };
}

function evolve(sim: ReturnType<typeof createSimulation>, seconds: number) {
  let s = sim;
  for (let i = 0; i < seconds; i++) {
    s = tickSimulation(s, 1);
  }
  return s;
}

function printSnap(s: Snapshot) {
  console.log(`  [${s.label}]`);
  console.log(`    PAM=${s.map} | DC=${s.co} | FC=${s.hr} | RVS=${s.svr}`);
  console.log(`    PVC=${s.cvp} | VVS=${s.svv} | GEDI=${s.gedi} | EVLW=${s.evlw}`);
  console.log(`    SvO2=${s.svo2} | Lac=${s.lactate} | DO2=${s.do2}`);
  console.log(`    PaO2=${s.pao2} | pH=${s.ph} | BV=${s.bv}mL`);
}

function checkAberration(s: Snapshot): string[] {
  const issues: string[] = [];
  if (s.map < 0 || s.map > 250) issues.push(`PAM aberrante: ${s.map}`);
  if (s.co < 0 || s.co > 20) issues.push(`DC aberrante: ${s.co}`);
  if (s.hr < 20 || s.hr > 220) issues.push(`FC aberrante: ${s.hr}`);
  if (s.svr < 100 || s.svr > 5000) issues.push(`RVS aberrante: ${s.svr}`);
  if (s.cvp < -5 || s.cvp > 40) issues.push(`PVC aberrante: ${s.cvp}`);
  if (s.svv < 0 || s.svv > 60) issues.push(`VVS aberrante: ${s.svv}`);
  if (s.gedi < 100 || s.gedi > 2000) issues.push(`GEDI aberrante: ${s.gedi}`);
  if (s.evlw < 3 || s.evlw > 60) issues.push(`EVLW aberrante: ${s.evlw}`);
  if (s.svo2 < 10 || s.svo2 > 95) issues.push(`SvO2 aberrante: ${s.svo2}`);
  if (s.lactate < 0 || s.lactate > 25) issues.push(`Lactato aberrante: ${s.lactate}`);
  if (s.do2 < 50 || s.do2 > 2000) issues.push(`DO2 aberrante: ${s.do2}`);
  if (s.pao2 < 20 || s.pao2 > 600) issues.push(`PaO2 aberrante: ${s.pao2}`);
  if (s.ph < 6.8 || s.ph > 7.7) issues.push(`pH aberrante: ${s.ph}`);
  if (s.bv < 1000 || s.bv > 10000) issues.push(`BV aberrante: ${s.bv}`);
  return issues;
}

function delta(before: Snapshot, after: Snapshot): string {
  const d = (field: keyof Snapshot) => {
    const b = before[field] as number;
    const a = after[field] as number;
    const diff = a - b;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(field === 'lactate' || field === 'ph' ? 2 : 0)}`;
  };
  return `    Δ PAM=${d('map')} | DC=${d('co')} | FC=${d('hr')} | RVS=${d('svr')} | PVC=${d('cvp')} | Lac=${d('lactate')}`;
}

function testCase(caseId: string) {
  const caseName = caseRegistry[caseId].name;
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`CASO: ${caseName} (${caseId})`);
  console.log(`${'═'.repeat(70)}`);

  const seed = 42;
  let totalAberrations = 0;
  const allSnaps: Snapshot[] = [];

  // ── 1. BASELINE ──
  console.log('\n── 1. BASELINE (30s evolução livre) ──');
  let sim = createSimulation(caseId, seed);
  const s0 = snap(sim, 'T=0 (inicial)');
  printSnap(s0);
  allSnaps.push(s0);

  sim = evolve(sim, 30);
  const s30 = snap(sim, 'T=30s (baseline)');
  printSnap(s30);
  console.log(delta(s0, s30));
  allSnaps.push(s30);

  // ── 2. VOLUME 500ml ──
  // Volume uses scheduled effect curves: latency 4s, rise ~60s, peak ~60s.
  // 120s should show clear effect.
  console.log('\n── 2. VOLUME (500ml cristaloide) ──');
  sim = runIntervention(sim, { type: 'give_fluid_bolus', volumeMl: 500 } as any);
  const sVolImmediate = snap(sim, 'Pós-bolus imediato');
  printSnap(sVolImmediate);
  console.log(delta(s30, sVolImmediate));
  allSnaps.push(sVolImmediate);

  sim = evolve(sim, 120);
  const sVol60 = snap(sim, 'Volume +120s');
  printSnap(sVol60);
  console.log(delta(sVolImmediate, sVol60));
  allSnaps.push(sVol60);

  // ── 3. RESET ──
  console.log('\n── 3. RESET após volume ──');
  sim = createSimulation(caseId, seed);
  sim = evolve(sim, 30);
  const sReset1 = snap(sim, 'Reset baseline');
  printSnap(sReset1);
  allSnaps.push(sReset1);

  // ── 4. NOREPINEFRINA ──
  // Norepi: onset 30-90s random, then tau ~90s to ramp up drive.
  // Wait 180s to see full effect.
  console.log('\n── 4. NOREPINEFRINA ──');
  sim = runIntervention(sim, { type: 'set_norepinephrine_rate', value: 0.1 } as any);
  console.log('  → Norepi 0.1 mcg/kg/min aplicada');
  sim = evolve(sim, 180);
  const sNorepi1 = snap(sim, 'Norepi 0.1 +180s');
  printSnap(sNorepi1);
  console.log(delta(sReset1, sNorepi1));
  allSnaps.push(sNorepi1);

  sim = runIntervention(sim, { type: 'set_norepinephrine_rate', value: 0.3 } as any);
  console.log('  → Norepi subida para 0.3 mcg/kg/min');
  sim = evolve(sim, 180);
  const sNorepi2 = snap(sim, 'Norepi 0.3 +180s');
  printSnap(sNorepi2);
  console.log(delta(sNorepi1, sNorepi2));
  allSnaps.push(sNorepi2);

  // ── 5. RESET ──
  console.log('\n── 5. RESET após norepi ──');
  sim = createSimulation(caseId, seed);
  sim = evolve(sim, 30);
  const sReset2 = snap(sim, 'Reset baseline');
  printSnap(sReset2);
  allSnaps.push(sReset2);

  // ── 6. DOBUTAMINA ──
  // Dobu: onset 20-60s, tau ~70s. Wait 150s.
  console.log('\n── 6. DOBUTAMINA ──');
  sim = runIntervention(sim, { type: 'set_dobutamine_rate', value: 5 } as any);
  console.log('  → Dobutamina 5 mcg/kg/min aplicada');
  sim = evolve(sim, 150);
  const sDobu1 = snap(sim, 'Dobu 5 +150s');
  printSnap(sDobu1);
  console.log(delta(sReset2, sDobu1));
  allSnaps.push(sDobu1);

  sim = runIntervention(sim, { type: 'set_dobutamine_rate', value: 10 } as any);
  console.log('  → Dobutamina subida para 10 mcg/kg/min');
  sim = evolve(sim, 150);
  const sDobu2 = snap(sim, 'Dobu 10 +150s');
  printSnap(sDobu2);
  console.log(delta(sDobu1, sDobu2));
  allSnaps.push(sDobu2);

  // ── 7. RESET ──
  console.log('\n── 7. RESET após dobutamina ──');
  sim = createSimulation(caseId, seed);
  sim = evolve(sim, 30);
  const sReset3 = snap(sim, 'Reset baseline');
  printSnap(sReset3);
  allSnaps.push(sReset3);

  // ── 8. VASOPRESSINA ──
  // Vasopressin: onset 60-180s, tau ~180s. Wait 300s.
  console.log('\n── 8. VASOPRESSINA ──');
  sim = runIntervention(sim, { type: 'set_vasopressin_rate', value: 0.03 } as any);
  console.log('  → Vasopressina 0.03 U/min aplicada');
  sim = evolve(sim, 300);
  const sVaso = snap(sim, 'Vasopressina 0.03 +300s');
  printSnap(sVaso);
  console.log(delta(sReset3, sVaso));
  allSnaps.push(sVaso);

  // ── ANÁLISE DE ABERRAÇÕES ──
  console.log('\n── ABERRAÇÕES ──');
  for (const s of allSnaps) {
    const issues = checkAberration(s);
    if (issues.length > 0) {
      totalAberrations += issues.length;
      console.log(`  ⚠ ${s.label}: ${issues.join('; ')}`);
    }
  }
  if (totalAberrations === 0) {
    console.log('  ✓ Nenhuma aberração detectada em nenhum snapshot');
  }

  // ── VERIFICAÇÃO DE CONSISTÊNCIA FISIOLÓGICA ──
  console.log('\n── CONSISTÊNCIA FISIOLÓGICA ──');
  
  // Volume deve aumentar DC (pelo menos não cair) — compare with same time without intervention
  const volDeltaCo = sVol60.co - s30.co;
  const volDeltaCvp = sVol60.cvp - s30.cvp;
  const volDeltaBv = sVol60.bv - s30.bv;
  console.log(`  Volume → DC: ${volDeltaCo > 0 ? '✓' : '⚠'} (Δ=${volDeltaCo.toFixed(2)}) | PVC: ${volDeltaCvp >= 0 ? '✓' : '⚠'} (Δ=${volDeltaCvp}) | BV: ${volDeltaBv > 0 ? '✓' : '⚠'} (Δ=${volDeltaBv}mL)`);

  // Norepi deve subir PAM e RVS (vs baseline sem droga)
  const norepDeltaMap = sNorepi1.map - sReset1.map;
  const norepDeltaSvr = sNorepi1.svr - sReset1.svr;
  console.log(`  Norepi 0.1 → PAM: ${norepDeltaMap > 0 ? '✓' : '⚠'} (Δ=${norepDeltaMap}) | RVS: ${norepDeltaSvr > 0 ? '✓' : '⚠'} (Δ=${norepDeltaSvr})`);

  // Dose-resposta: norepi 0.3 deve dar mais PAM que 0.1
  const norepDoseResp = sNorepi2.map >= sNorepi1.map;
  console.log(`  Norepi dose-resp: ${norepDoseResp ? '✓' : '⚠'} (PAM 0.1→${sNorepi1.map}, 0.3→${sNorepi2.map})`);

  // Dobu deve aumentar DC
  const dobuDeltaCo = sDobu1.co - sReset2.co;
  const dobuDeltaHr = sDobu1.hr - sReset2.hr;
  console.log(`  Dobu 5 → DC: ${dobuDeltaCo > 0 ? '✓' : '⚠'} (Δ=${dobuDeltaCo.toFixed(2)}) | FC: ${dobuDeltaHr > 0 ? '✓' : '⚠'} (Δ=${dobuDeltaHr})`);

  // Dose-resposta dobu
  const dobuDoseResp = sDobu2.co >= sDobu1.co;
  console.log(`  Dobu dose-resp: ${dobuDoseResp ? '✓' : '⚠'} (DC 5→${sDobu1.co}, 10→${sDobu2.co})`);

  // Vasopressina deve subir PAM
  const vasoDeltaMap = sVaso.map - sReset3.map;
  const vasoDeltaSvr = sVaso.svr - sReset3.svr;
  console.log(`  Vasopressina → PAM: ${vasoDeltaMap > 0 ? '✓' : '⚠'} (Δ=${vasoDeltaMap}) | RVS: ${vasoDeltaSvr > 0 ? '✓' : '⚠'} (Δ=${vasoDeltaSvr})`);

  // Reset deve ser determinístico (mesma seed)
  const resetOk = sReset1.map === sReset2.map && sReset2.map === sReset3.map;
  console.log(`  Reset determinístico: ${resetOk ? '✓' : '⚠'} (PAMs: ${sReset1.map}, ${sReset2.map}, ${sReset3.map})`);

  return totalAberrations;
}

// ── RUN ALL CASES ──
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║        AUDITORIA CLÍNICA COMPLETA — TODOS OS CENÁRIOS              ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

let grandTotal = 0;
const caseIds = Object.keys(caseRegistry);

for (const caseId of caseIds) {
  grandTotal += testCase(caseId);
}

console.log(`\n${'═'.repeat(70)}`);
console.log(`RESUMO FINAL: ${caseIds.length} casos testados, ${grandTotal} aberrações totais`);
console.log(`${'═'.repeat(70)}\n`);

if (grandTotal > 0) {
  process.exit(1);
}
