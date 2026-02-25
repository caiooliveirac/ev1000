import sepsisCase from '@/cases/sepsis-advanced.json';
import hypoCase from '@/cases/choque-hipovolemico-hemorragico.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const run = (s: PatientState, n: number) => { let c = s; for (let i = 0; i < n; i++) c = step(c, 1); return c; };

// Compare bolus vs no-bolus at each timepoint
for (const [name, cas] of [['sepsis', sepsisCase], ['hypo', hypoCase]] as const) {
  const base = run(initializeCase(cas as CaseData, 42), 180);
  const bolused = applyIntervention(base, { type: 'give_fluid_bolus', volumeMl: 500 });
  
  console.log(`\n=== ${name} at t=180: CO=${base.visible.cardiacOutput.toFixed(2)} BV=${base.hidden.bloodVolume.toFixed(0)} GEDI=${base.visible.gedi.toFixed(0)} eqGEDI=${base.hidden.equilibriumGEDI.toFixed(0)} eqCO=${base.hidden.equilibriumCO.toFixed(2)} eqProduct=${base.hidden.equilibriumStarlingProduct.toFixed(4)} ===`);
  
  let sB = bolused;
  let sN = base;
  for (let t = 1; t <= 420; t++) {
    sB = step(sB, 1);
    sN = step(sN, 1);
    if ([30,60,120,180,300,420].includes(t)) {
      const delta = ((sB.visible.cardiacOutput - sN.visible.cardiacOutput) / base.visible.cardiacOutput * 100).toFixed(2);
      console.log(`t=${t}s  Bolus-NoBolus ΔCO=${delta}%  bolusCO=${sB.visible.cardiacOutput.toFixed(2)} noBolusCO=${sN.visible.cardiacOutput.toFixed(2)}  ΔBV=${(sB.hidden.bloodVolume-sN.hidden.bloodVolume).toFixed(0)}mL  bGEDI=${sB.visible.gedi.toFixed(0)} nGEDI=${sN.visible.gedi.toFixed(0)}`);
    }
  }
}
