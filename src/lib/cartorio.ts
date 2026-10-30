import { RegistroImobiliario, Exigencia, ProrrogacaoPrazo } from './types';
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
    const limite = new Date(limitePrenotacao(registro)! + 'T12:00:00').getTime();
    prenotacaoDiasRestantes = Math.round((limite - Date.now()) / 86400000);
  }
  return { stages, exigenciasAbertas, temRegistro, currentIdx, prenotacaoDiasRestantes };
}

const MS_DIA = 86400000;

function somarDias(iso: string, dias: number): string {
  return new Date(new Date(iso + 'T12:00:00').getTime() + dias * MS_DIA).toISOString().slice(0, 10);
}

function diasEntre(deIso: string, ateIso: string): number {
  return Math.round((new Date(ateIso + 'T12:00:00').getTime() - new Date(deIso + 'T12:00:00').getTime()) / MS_DIA);
}

const fmtData = (iso: string) => iso.split('-').reverse().join('/');

/** Data limite (yyyy-mm-dd) da prenotação: início + prazo (30 dias, ou o que o ofício deu / foi prorrogado). */
export function limitePrenotacao(registro: RegistroImobiliario | undefined): string | null {
  if (!registro?.dataPrenotacao) return null;
  return somarDias(registro.dataPrenotacao, registro.prazoPrenotacaoDias || 30);
}

/** Sugestões de novo limite: +15/+30/+60 dias a partir do limite atual — ou de hoje, se ele já passou
 *  (prorrogar um prazo vencido conta da data em que foi concedido). */
export function sugestoesProrrogacao(limiteAtual: string | null, hoje: string): { dias: number; data: string }[] {
  const base = limiteAtual && limiteAtual > hoje ? limiteAtual : hoje;
  return [15, 30, 60].map(dias => ({ dias, data: somarDias(base, dias) }));
}

function validarNovoLimite(limiteAtual: string | null, novoLimite: string, hoje: string, rotulo: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(novoLimite)) throw new Error('Informe o novo prazo.');
  if (limiteAtual && novoLimite <= limiteAtual) throw new Error(`O novo prazo precisa ser depois do atual (${fmtData(limiteAtual)}).`);
  if (novoLimite < hoje) throw new Error(`O novo prazo ${rotulo} não pode estar no passado.`);
}

function novaProrrogacao(de: string, ate: string, motivo: string | undefined, agora: number): ProrrogacaoPrazo {
  return { id: crypto.randomUUID(), em: agora, de, ate, motivo: motivo?.trim() || undefined };
}

/** Prorroga a prenotação até `novoLimite`: ajusta o prazo (em dias contados do início) — que é o que alertas e
 *  Dashboard já leem — e guarda a prorrogação no histórico. Lança Error com mensagem pronta pra exibir. */
export function prorrogarPrenotacao(registro: RegistroImobiliario, novoLimite: string, motivo?: string, agora = Date.now(), hoje = new Date().toISOString().slice(0, 10)): RegistroImobiliario {
  const atual = limitePrenotacao(registro);
  if (!registro.dataPrenotacao || !atual) throw new Error('Registre o protocolo antes de prorrogar a prenotação.');
  validarNovoLimite(atual, novoLimite, hoje, 'da prenotação');
  return {
    ...registro,
    prazoPrenotacaoDias: diasEntre(registro.dataPrenotacao, novoLimite),
    prorrogacoes: [...(registro.prorrogacoes || []), novaProrrogacao(atual, novoLimite, motivo, agora)],
  };
}

/** Prorroga o prazo de uma exigência em aberto. O `prazo` da exigência passa a ser o novo limite. */
export function prorrogarExigencia(registro: RegistroImobiliario, exigenciaId: string, novoPrazo: string, motivo?: string, agora = Date.now(), hoje = new Date().toISOString().slice(0, 10)): RegistroImobiliario {
  const exigencia = (registro.exigencias || []).find(e => e.id === exigenciaId);
  if (!exigencia) throw new Error('Exigência não encontrada.');
  if (exigencia.status !== 'Aberta') throw new Error('Só dá para prorrogar exigência em aberto.');
  validarNovoLimite(exigencia.prazo || null, novoPrazo, hoje, 'da exigência');
  const atualizada: Exigencia = {
    ...exigencia,
    prazo: novoPrazo,
    prorrogacoes: [...(exigencia.prorrogacoes || []), ...(exigencia.prazo ? [novaProrrogacao(exigencia.prazo, novoPrazo, motivo, agora)] : [])],
  };
  return { ...registro, exigencias: (registro.exigencias || []).map(e => (e.id === exigenciaId ? atualizada : e)) };
}
