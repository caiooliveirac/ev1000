import sepsisCase from '@/cases/sepsis-advanced.json';
import { applyIntervention, initializeCase, step } from '@/engine/model';
import { CaseData, PatientState } from '@/engine/types';

let state = initializeCase(sepsisCase as CaseData, 42);
state = applyIntervention(state, { type: 'set_peep', value: 20 });
state = applyIntervention(state, { type: 'set_norepinephrine_rate', value: 0.9 });
for (let i = 0; i < 180; i++) state = step(state, 1);

console.log("limiterLog:", state.hidden.limiterLog.length, state.hidden.limiterLog.slice(-3));
console.log("clampLog:", state.hidden.clampLog.length, state.hidden.clampLog.slice(-5));
console.log("CO:", state.visible.cardiacOutput.toFixed(2), "MAP:", state.visible.map.toFixed(0));
