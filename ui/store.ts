import { create } from 'zustand';
import { Intervention } from '@/engine/types';
import { createSimulation, runIntervention, tickSimulation } from '@/sim/simulation';
import { SimulationState } from '@/sim/types';

interface SimulationStore {
  sim: SimulationState;
  running: boolean;
  seed: number;
  caseId: string;
  trendWindowSec: number;
  tick: () => void;
  apply: (intervention: Intervention) => void;
  setNorepinephrineRate: (rate: number) => void;
  setDobutamineRate: (rate: number) => void;
  setVasopressinRate: (rate: number) => void;
  giveFluidBolus: (volumeMl: number) => void;
  giveTransfusion: (units: number, targetHb?: number) => void;
  setFio2: (fio2: number) => void;
  setPeep: (peep: number) => void;
  setVt: (vt: number) => void;
  setTrendWindow: (seconds: number) => void;
  setCaseId: (caseId: string) => void;
  toggleRunning: () => void;
  reset: () => void;
  setSeed: (seed: number) => void;
}

const DEFAULT_CASE_ID = 'sepsis_advanced';

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  sim: createSimulation(DEFAULT_CASE_ID, 42),
  running: true,
  seed: 42,
  caseId: DEFAULT_CASE_ID,
  trendWindowSec: 600,
  tick: () => {
    const { running, sim } = get();
    if (!running) {
      return;
    }
    set({ sim: tickSimulation(sim, 1) });
  },
  apply: (intervention) => {
    set((state) => ({ sim: runIntervention(state.sim, intervention) }));
  },
  setNorepinephrineRate: (rate) => {
    get().apply({ type: 'set_norepinephrine_rate', value: rate });
  },
  setDobutamineRate: (rate) => {
    get().apply({ type: 'set_dobutamine_rate', value: rate });
  },
  setVasopressinRate: (rate) => {
    get().apply({ type: 'set_vasopressin_rate', value: rate });
  },
  giveFluidBolus: (volumeMl) => {
    get().apply({ type: 'give_fluid_bolus', volumeMl, fluidType: 'crystalloid' });
  },
  giveTransfusion: (units, targetHb) => {
    get().apply({ type: 'give_transfusion', units, targetHb });
  },
  setFio2: (fio2) => {
    get().apply({ type: 'set_fio2', value: fio2 });
  },
  setPeep: (peep) => {
    get().apply({ type: 'set_peep', value: peep });
  },
  setVt: (vt) => {
    get().apply({ type: 'set_vt', value: vt });
  },
  setTrendWindow: (seconds) => {
    set({ trendWindowSec: seconds });
  },
  toggleRunning: () => {
    set((state) => ({ running: !state.running }));
  },
  reset: () => {
    const { seed, caseId } = get();
    set({ sim: createSimulation(caseId, seed), running: true });
  },
  setSeed: (seed) => {
    const caseId = get().caseId;
    set({ seed, sim: createSimulation(caseId, seed), running: true });
  },
  setCaseId: (caseId) => {
    const seed = get().seed;
    set({ caseId, sim: createSimulation(caseId, seed), running: true });
  }
}));
