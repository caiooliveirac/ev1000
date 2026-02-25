import eapCase from '@/cases/eap-cardiogenico.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const run = (s: PatientState, n: number) => { let c = s; for (let i = 0; i < n; i++) c = step(c, 1); return c; };

// Compare EAP-C norad vs control at each time point
let ctrl = initializeCase(eapCase as CaseData, 42);
let norad = applyIntervention(initializeCase(eapCase as CaseData, 42), { type: 'set_norepinephrine_rate', value: 0.2 });

for (let t = 1; t <= 300; t++) {
  ctrl = step(ctrl, 1);
  norad = step(norad, 1);
  if ([30,60,120,180,240,300].includes(t)) {
    const ratio = (norad.visible.cardiacOutput / ctrl.visible.cardiacOutput * 100 - 100).toFixed(1);
    console.log(`t=${t}s  ctrlCO=${ctrl.visible.cardiacOutput.toFixed(2)} noradCO=${norad.visible.cardiacOutput.toFixed(2)} ratio=${ratio}%  SVR_n=${norad.visible.svr.toFixed(0)} EVLW_n=${norad.visible.evlw.toFixed(1)} MAP_n=${norad.visible.map.toFixed(0)}`);
  }
}
