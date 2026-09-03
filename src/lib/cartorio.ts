import { RegistroImobiliario, Exigencia } from './types';
import { StepperStage } from '@/components/ui/Stepper';

export interface CartorioProgress {
  stages: StepperStage[];
  exigenciasAbertas: Exigencia[];
  temRegistro: boolean;
  currentIdx: number;
  prenotacaoDiasRestantes: number | null;
}

const STAGE_LABELS = ['Protocolo', 'Prenotação', 'Exigências', 'Matrícula', 'Concluído'];

export function computeCartorioProgress(registro: RegistroImobiliario | undefined): CartorioProgress {
  const exigenciasAbertas = (registro?.exigencias || [])
    .filter(e => e.status === 'Aberta')
    .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  const hoje = new Date().toISOString().slice(0, 10);
  const exigenciaVencida = exigenciasAbertas.some(e => e.prazo && e.prazo < hoje);
  const doneFlags = [!!registro?.protocolo, !!registro?.dataPrenotacao, exigenciasAbertas.length === 0, !!registro?.matricula, !!registro?.matricula];
  let currentIdx = doneFlags.findIndex(d => !d);
  if (currentIdx === -1) currentIdx = doneFlags.length;
  const stages: StepperStage[] = STAGE_LABELS.map((label, i) => ({
    label,
    state: i < currentIdx ? 'done' : i === currentIdx ? (i === 2 && exigenciaVencida ? 'blocked' : 'current') : 'upcoming',
  }));
  const temRegistro = !!(registro?.protocolo || registro?.dataPrenotacao || registro?.matricula || (registro?.exigencias && registro.exigencias.length > 0));
  let prenotacaoDiasRestantes: number | null = null;
  if (registro?.dataPrenotacao) {
    const prazoDias = registro.prazoPrenotacaoDias || 30;
    const limite = new Date(registro.dataPrenotacao + 'T12:00:00').getTime() + prazoDias * 86400000;
    prenotacaoDiasRestantes = Math.round((limite - Date.now()) / 86400000);
  }
  return { stages, exigenciasAbertas, temRegistro, currentIdx, prenotacaoDiasRestantes };
}
