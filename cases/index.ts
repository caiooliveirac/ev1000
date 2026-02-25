import sepsisAdvanced from '@/cases/sepsis-advanced.json';
import eapCardiogenico from '@/cases/eap-cardiogenico.json';
import choqueHipovolemico from '@/cases/choque-hipovolemico-hemorragico.json';
import tepMacico from '@/cases/tep-macico-obstrutivo.json';
import eapPerfilL from '@/cases/eap-perfil-l.json';
import { CaseData } from '@/engine/types';

export const caseRegistry: Record<string, CaseData> = {
  [sepsisAdvanced.id]: sepsisAdvanced as CaseData,
  [eapCardiogenico.id]: eapCardiogenico as CaseData,
  [choqueHipovolemico.id]: choqueHipovolemico as CaseData,
  [tepMacico.id]: tepMacico as CaseData,
  [eapPerfilL.id]: eapPerfilL as CaseData
};

export const caseOptions = Object.values(caseRegistry).map((caseData) => ({
  id: caseData.id,
  name: caseData.name
}));

export const getCaseById = (id: string): CaseData => {
  const caseData = caseRegistry[id];
  if (!caseData) {
    throw new Error(`Unknown case: ${id}`);
  }
  return caseData;
};
