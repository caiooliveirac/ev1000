import eapCase from '@/cases/eap-cardiogenico.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

const run = (s: PatientState, n: number) => { let c = s; for (let i = 0; i < n; i++) c = step(c, 1); return c; };

const base = initializeCase(eapCase as CaseData, 42);
const control = run(base, 180);
const norad = run(applyIntervention(base, { type: 'set_norepinephrine_rate', value: 0.2 }), 180);

console.log("control CO:", control.visible.cardiacOutput.toFixed(2), "SVR:", control.visible.svr.toFixed(0), "MAP:", control.visible.map.toFixed(0), "GEDI:", control.visible.gedi.toFixed(0));
console.log("norad CO:", norad.visible.cardiacOutput.toFixed(2), "SVR:", norad.visible.svr.toFixed(0), "MAP:", norad.visible.map.toFixed(0), "GEDI:", norad.visible.gedi.toFixed(0));
console.log("norad hidden SVR:", norad.hidden.basalSVR, "eqSVR:", norad.hidden.equilibriumSVR);

// Track CO over time with norad
let s = applyIntervention(base, { type: 'set_norepinephrine_rate', value: 0.2 });
for (let t = 1; t <= 180; t++) {
  s = step(s, 1);
  if ([5,10,30,60,120,180].includes(t)) {
    console.log(`t=${t}s  CO=${s.visible.cardiacOutput.toFixed(2)}  SVR=${s.visible.svr.toFixed(0)}  MAP=${s.visible.map.toFixed(0)}  GEDI=${s.visible.gedi.toFixed(0)}  EVLW=${s.visible.evlw.toFixed(1)}`);
  }
}
