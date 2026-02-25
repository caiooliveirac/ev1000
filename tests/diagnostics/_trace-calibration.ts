import { initializeCase, step } from '@/engine/model';
import sepsis from '@/cases/sepsis-advanced.json';
import tep from '@/cases/tep-macico-obstrutivo.json';
import type { CaseData, PatientState } from '@/engine/types';

function traceCase(name: string, caseJson: CaseData) {
  let s = initializeCase(caseJson, 42);
  const co0 = s.visible.cardiacOutput;

  // Run 300 steps
  for (let t = 0; t < 300; t++) {
    s = step(s, 1);
  }

  console.log(`\n${name}: CO ${co0.toFixed(2)} → ${s.visible.cardiacOutput.toFixed(2)} (${((s.visible.cardiacOutput/co0 - 1) * 100).toFixed(1)}%)`);
  console.log(`  SVR: ${s.visible.svr.toFixed(0)}  GEDI: ${s.visible.gedi.toFixed(0)}  EVLW: ${s.visible.evlw.toFixed(1)}`);
  console.log(`  volOffset: ${s.hidden.volumeCoOffset.toFixed(4)}`);
  console.log(`  eqStarlingProduct: ${s.hidden.equilibriumStarlingProduct.toFixed(4)}`);
  console.log(`  eqCO: ${s.hidden.equilibriumCO.toFixed(2)}  eqGEDI: ${s.hidden.equilibriumGEDI.toFixed(0)}  eqSVR: ${s.hidden.equilibriumSVR.toFixed(0)}`);

  // Now run one more step and instrument it
  const prev = JSON.parse(JSON.stringify(s)) as PatientState;
  const next = step(s, 1);
  
  // Compare clampLog to see what calibrations are doing
  const clampLog = next.hidden.clampLog || [];
  const coEntries = clampLog.filter(e => e.label.includes('cardiacOutput') || e.label.includes('coTarget'));
  console.log(`  Clamp log CO entries at t=300:`);
  for (const e of coEntries) {
    console.log(`    ${e.label}: raw=${e.rawValue.toFixed(3)} clamped=${e.clampedValue.toFixed(3)}`);
  }
}

traceCase('sepsis', sepsis as unknown as CaseData);
traceCase('tep', tep as unknown as CaseData);
