import sepsisCase from '@/cases/sepsis-advanced.json';
import hypoCase from '@/cases/choque-hipovolemico-hemorragico.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const run = (s: PatientState, n: number) => { let c = s; for (let i = 0; i < n; i++) c = step(c, 1); return c; };

for (const [name, cas] of [['sepsis', sepsisCase], ['hypo', hypoCase]] as const) {
  const base = run(initializeCase(cas as CaseData, 42), 180);
  const bolused = applyIntervention(base, { type: 'give_fluid_bolus', volumeMl: 500 });
  
  console.log(`\n=== ${name} baseline CO=${base.visible.cardiacOutput.toFixed(2)} BV=${base.hidden.bloodVolume.toFixed(0)} GEDI=${base.visible.gedi.toFixed(0)} ===`);
  
  let s = bolused;
  for (let t = 1; t <= 420; t++) {
    s = step(s, 1);
    if ([5,10,30,60,120,180,300,420].includes(t)) {
      const dCO = ((s.visible.cardiacOutput - base.visible.cardiacOutput) / base.visible.cardiacOutput * 100).toFixed(2);
      const dBV = (s.hidden.bloodVolume - base.hidden.bloodVolume).toFixed(0);
      const dGEDI = (s.visible.gedi - base.visible.gedi).toFixed(0);
      const dPMS = (s.hidden.meanSystemicFillingPressure - base.hidden.meanSystemicFillingPressure).toFixed(2);
      const dVR = (s.hidden.venousReturnFlow - base.hidden.venousReturnFlow).toFixed(2);
      console.log(`t=${t}s  ΔCO=${dCO}%  ΔBV=${dBV}mL  ΔGEDI=${dGEDI}  ΔPMS=${dPMS}  ΔVR=${dVR}  CO=${s.visible.cardiacOutput.toFixed(2)}`);
    }
  }
}
