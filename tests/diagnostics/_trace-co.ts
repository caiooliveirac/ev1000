import { initializeCase, step } from '@/engine/model';
import eapC from '@/cases/eap-cardiogenico.json';
import type { CaseData } from '@/engine/types';

const state = initializeCase(eapC as unknown as CaseData, 42);
let s = state;
for (let t = 0; t < 300; t++) {
  s = step(s, 1);
  if (t % 30 === 0 || t < 5) {
    console.log(`t=${t}  CO=${s.visible.cardiacOutput.toFixed(3)}  SVR=${s.visible.svr.toFixed(0)}  GEDI=${s.visible.gedi.toFixed(0)}  EVLW=${s.visible.evlw.toFixed(1)}  volOff=${s.hidden.volumeCoOffset.toFixed(4)}`);
  }
}
