import { describe, test } from 'vitest';
import hypo from '@/cases/choque-hipovolemico-hemorragico.json';
import cardio from '@/cases/eap-cardiogenico.json';
import sepsis from '@/cases/sepsis-advanced.json';
import tep from '@/cases/tep-macico-obstrutivo.json';
import { initializeCase, applyIntervention, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';
const run=(s:PatientState,sec:number)=>{let c=s;for(let i=0;i<sec;i++) c=step(c,1); return c;};
describe('diag',()=>{test('print',()=>{
const seed=808;
const seedPhys=2026;
const seedMatrix=91;
const hBase=run(initializeCase(hypo as CaseData,seed),420);
console.log('hypo params', initializeCase(hypo as CaseData,seed).profileParameters);
const hBol=run(applyIntervention(initializeCase(hypo as CaseData,seed),{type:'give_fluid_bolus',volumeMl:1000}),420);
console.log('hypo', {baseCO:hBase.visible.cardiacOutput, bolCO:hBol.visible.cardiacOutput, d:hBol.visible.cardiacOutput-hBase.visible.cardiacOutput, baseGEDI:hBase.visible.gedi, bolGEDI:hBol.visible.gedi, baseSVV:hBase.visible.svv, bolSVV:hBol.visible.svv, baseCVP:hBase.visible.cvp, bolCVP:hBol.visible.cvp});
console.log('hypo hidden', {
  baseBV:hBase.hidden.bloodVolume,
  bolBV:hBol.hidden.bloodVolume,
  basePMS:hBase.hidden.meanSystemicFillingPressure,
  bolPMS:hBol.hidden.meanSystemicFillingPressure,
  baseVR:hBase.hidden.venousReturnFlow,
  bolVR:hBol.hidden.venousReturnFlow,
  baseRAP:hBase.hidden.rightAtrialPressure,
  bolRAP:hBol.hidden.rightAtrialPressure,
  baseOffset:hBase.hidden.volumeCoOffset,
  bolOffset:hBol.hidden.volumeCoOffset,
  baseVES:hBase.hidden.volumeEffectSite,
  bolVES:hBol.hidden.volumeEffectSite,
  baseLVP:hBase.hidden.leftVentricularPreload,
  bolLVP:hBol.hidden.leftVentricularPreload,
  basePVR:hBase.hidden.pulmonaryResistance,
  bolPVR:hBol.hidden.pulmonaryResistance
});
const cBase=run(initializeCase(cardio as CaseData,seed),420);
const cBol=run(applyIntervention(initializeCase(cardio as CaseData,seed),{type:'give_fluid_bolus',volumeMl:1000}),420);
console.log('cardio', {baseCO:cBase.visible.cardiacOutput, bolCO:cBol.visible.cardiacOutput, d:cBol.visible.cardiacOutput-cBase.visible.cardiacOutput, baseGEDI:cBase.visible.gedi, bolGEDI:cBol.visible.gedi});
console.log('cardio hidden', {
  baseBV:cBase.hidden.bloodVolume,
  bolBV:cBol.hidden.bloodVolume,
  basePMS:cBase.hidden.meanSystemicFillingPressure,
  bolPMS:cBol.hidden.meanSystemicFillingPressure,
  baseVR:cBase.hidden.venousReturnFlow,
  bolVR:cBol.hidden.venousReturnFlow,
  baseRAP:cBase.hidden.rightAtrialPressure,
  bolRAP:cBol.hidden.rightAtrialPressure,
  baseOffset:cBase.hidden.volumeCoOffset,
  bolOffset:cBol.hidden.volumeCoOffset,
  baseVES:cBase.hidden.volumeEffectSite,
  bolVES:cBol.hidden.volumeEffectSite
});
const sBase=run(initializeCase(sepsis as CaseData,42),300);
const sNor=run(applyIntervention(initializeCase(sepsis as CaseData,42),{type:'set_norepinephrine_rate',value:0.2}),300);
console.log('sepsis norad', {baseCO:sBase.visible.cardiacOutput, norCO:sNor.visible.cardiacOutput, baseMAP:sBase.visible.map, norMAP:sNor.visible.map, baseSVR:sBase.visible.svr, norSVR:sNor.visible.svr});
console.log('sepsis hidden', {
  basePMS:sBase.hidden.meanSystemicFillingPressure,
  baseRAP:sBase.hidden.rightAtrialPressure,
  baseVR:sBase.hidden.venousReturnFlow,
  baseGEDI:sBase.visible.gedi,
  baseLAP:sBase.hidden.leftAtrialPressure,
  norPMS:sNor.hidden.meanSystemicFillingPressure,
  norRAP:sNor.hidden.rightAtrialPressure,
  norVR:sNor.hidden.venousReturnFlow,
  norGEDI:sNor.visible.gedi,
  norLAP:sNor.hidden.leftAtrialPressure
});

const hBasePhys=run(initializeCase(hypo as CaseData,seedPhys),420);
const hBolPhys=run(applyIntervention(initializeCase(hypo as CaseData,seedPhys),{type:'give_fluid_bolus',volumeMl:1000}),420);
const cBasePhys=run(initializeCase(cardio as CaseData,seedPhys),420);
const cBolPhys=run(applyIntervention(initializeCase(cardio as CaseData,seedPhys),{type:'give_fluid_bolus',volumeMl:1000}),420);
console.log('seed2026', {
  hypoBaseCO:hBasePhys.visible.cardiacOutput,
  hypoBolCO:hBolPhys.visible.cardiacOutput,
  hypoDelta:hBolPhys.visible.cardiacOutput-hBasePhys.visible.cardiacOutput,
  hypoBaseGEDI:hBasePhys.visible.gedi,
  hypoBolGEDI:hBolPhys.visible.gedi,
  hypoBaseBV:hBasePhys.hidden.bloodVolume,
  hypoBolBV:hBolPhys.hidden.bloodVolume,
  hypoBasePMS:hBasePhys.hidden.meanSystemicFillingPressure,
  hypoBolPMS:hBolPhys.hidden.meanSystemicFillingPressure,
  hypoBaseVR:hBasePhys.hidden.venousReturnFlow,
  hypoBolVR:hBolPhys.hidden.venousReturnFlow,
  hypoBaseRAP:hBasePhys.hidden.rightAtrialPressure,
  hypoBolRAP:hBolPhys.hidden.rightAtrialPressure,
  cardioBaseCO:cBasePhys.visible.cardiacOutput,
  cardioBolCO:cBolPhys.visible.cardiacOutput,
  cardioDelta:cBolPhys.visible.cardiacOutput-cBasePhys.visible.cardiacOutput,
  cardioBaseGEDI:cBasePhys.visible.gedi,
  cardioBolGEDI:cBolPhys.visible.gedi
});

let stress = initializeCase(sepsis as CaseData, 42);
stress = applyIntervention(stress, { type: 'set_norepinephrine_rate', value: 0.9 });
stress = applyIntervention(stress, { type: 'set_peep', value: 20 });
let minCo = Number.POSITIVE_INFINITY;
for (let t = 1; t <= 60; t += 1) {
  stress = step(stress, 1);
  minCo = Math.min(minCo, stress.visible.cardiacOutput);
  if (t % 10 === 0 || t === 1) {
    console.log('stress', t, {
      co: stress.visible.cardiacOutput,
      map: stress.visible.map,
      svr: stress.visible.svr,
      rap: stress.hidden.rightAtrialPressure,
      pms: stress.hidden.meanSystemicFillingPressure,
      vr: stress.hidden.venousReturnFlow,
      peep: stress.visible.peep,
      norepiDrive: stress.hidden.norepinephrineDrive,
      pvr: stress.hidden.pulmonaryResistance
    });
  }
}
console.log('stress minCo60', minCo);

const hypoControlM=run(initializeCase(hypo as CaseData,seedMatrix),300);
const hypoBolusM=run(applyIntervention(initializeCase(hypo as CaseData,seedMatrix),{type:'give_fluid_bolus',volumeMl:1000}),300);
console.log('hypo matrix seed91', {
  co0:hypoControlM.visible.cardiacOutput,
  co1:hypoBolusM.visible.cardiacOutput,
  gedi0:hypoControlM.visible.gedi,
  gedi1:hypoBolusM.visible.gedi,
  svv0:hypoControlM.visible.svv,
  svv1:hypoBolusM.visible.svv,
  cvp0:hypoControlM.visible.cvp,
  cvp1:hypoBolusM.visible.cvp,
  condCo:hypoBolusM.visible.cardiacOutput >= hypoControlM.visible.cardiacOutput * 1.2,
  condGedi:hypoBolusM.visible.gedi > hypoControlM.visible.gedi + 50,
  condSvv:hypoBolusM.visible.svv < hypoControlM.visible.svv - 2
});

const tepBase=run(initializeCase(tep as CaseData,808),300);
const tepHighPeep=run(applyIntervention(initializeCase(tep as CaseData,808),{type:'set_peep',value:16}),300);
console.log('tep peep', {
  baseCO:tepBase.visible.cardiacOutput,
  highCO:tepHighPeep.visible.cardiacOutput,
  basePVR:tepBase.hidden.pulmonaryResistance,
  highPVR:tepHighPeep.hidden.pulmonaryResistance,
  baseRAP:tepBase.hidden.rightAtrialPressure,
  highRAP:tepHighPeep.hidden.rightAtrialPressure,
  baseGEDI:tepBase.visible.gedi,
  highGEDI:tepHighPeep.visible.gedi,
  basePEEP:tepBase.visible.peep,
  highPEEP:tepHighPeep.visible.peep
});

const peakCoPct=(base:PatientState, vol:number, horizon=420)=>{let s=applyIntervention(base,{type:'give_fluid_bolus',volumeMl:vol}); const b=Math.max(base.visible.cardiacOutput,0.1); let peak=s.visible.cardiacOutput; for(let i=0;i<horizon;i++){s=step(s,1); if(s.visible.cardiacOutput>peak) peak=s.visible.cardiacOutput;} return ((peak-b)/b)*100;};
const sepBase180=run(initializeCase(sepsis as CaseData,42),180);
console.log('sepsis peak pct', {
  baseCO:sepBase180.visible.cardiacOutput,
  d500:peakCoPct(sepBase180,500),
  d1000:peakCoPct(sepBase180,1000),
  d2000:peakCoPct(sepBase180,2000)
});
});});
