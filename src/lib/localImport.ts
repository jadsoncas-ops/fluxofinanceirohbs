import { supabase } from '@/integrations/supabase/client';
import { _mappers } from '@/lib/storage';
import { Transaction, Client, Process, Task, Account, Partner, DocumentRecord, Proposta, Contrato, HistoricoEvent, CompanyConfig, PrecificacaoConfig } from '@/lib/types';
import type { Database } from '@/integrations/supabase/types';

// ============================================================================
// Importação ÚNICA dos dados que hoje vivem no localStorage deste navegador
// pro Supabase. Só existe pra fazer a transição — depois que os dados
// estiverem no Supabase, todo dispositivo lê de lá (ver src/lib/storage.ts).
// ============================================================================

function readLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLocalObject<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** true se ainda não existe nenhum cliente no Supabase — usado pra evitar duplicar em reimportações. */
export async function remoteIsEmpty(): Promise<boolean> {
  const { count } = await supabase.from('hbs_clients').select('*', { count: 'exact', head: true });
  return (count ?? 0) === 0;
}

export interface ImportSummary {
  clientes: number; lancamentos: number; processos: number; tarefas: number;
  contas: number; parceiros: number; documentos: number; propostas: number;
  contratos: number; historico: number;
  falhas: string[];
}

async function upsertTable<Name extends keyof Database['public']['Tables']>(
  table: Name,
  rows: Database['public']['Tables'][Name]['Insert'][],
  falhas: string[],
  label: string,
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabase.from(table).upsert(rows as never);
  if (error) {
    console.error(`[importação única] falha em ${label}:`, error);
    falhas.push(`${label}: ${error.message}`);
    return 0;
  }
  return rows.length;
}

export async function importarDadosLocaisParaSupabase(): Promise<ImportSummary> {
  const clients = readLocalArray<Client>('hbs_clients');
  const transactions = readLocalArray<Transaction>('hbs_transactions');
  const processes = readLocalArray<Process>('hbs_processes');
  const tasks = readLocalArray<Task>('hbs_tasks');
  const accounts = readLocalArray<Account>('hbs_accounts');
  const partners = readLocalArray<Partner>('hbs_partners');
  const documents = readLocalArray<DocumentRecord>('hbs_documents');
  const propostas = readLocalArray<Proposta>('hbs_propostas');
  const contratos = readLocalArray<Contrato>('hbs_contratos');
  const historico = readLocalArray<HistoricoEvent>('hbs_historico');
  const companyConfig = readLocalObject<CompanyConfig>('hbs_company_config');
  const precificacaoConfig = readLocalObject<PrecificacaoConfig>('hbs_precificacao_config');

  const falhas: string[] = [];

  // Ordem respeita as FKs: clientes/parceiros/contas primeiro, depois quem depende delas.
  const clientesOk = await upsertTable('hbs_clients', clients.map(_mappers.clientToRow), falhas, 'clientes');
  const parceirosOk = await upsertTable('hbs_partners', partners.map(_mappers.partnerToRow), falhas, 'parceiros');
  const contasOk = await upsertTable('hbs_accounts', accounts.map(_mappers.accountToRow), falhas, 'contas');
  const processosOk = await upsertTable('hbs_processes', processes.map(_mappers.processToRow), falhas, 'trabalhos');
  const lancamentosOk = await upsertTable('hbs_transactions', transactions.map(_mappers.transactionToRow), falhas, 'lançamentos');
  const tarefasOk = await upsertTable('hbs_tasks', tasks.map(_mappers.taskToRow), falhas, 'tarefas');
  const documentosOk = await upsertTable('hbs_documents', documents.map(_mappers.documentToRow), falhas, 'documentos');
  const propostasOk = await upsertTable('hbs_propostas', propostas.map(_mappers.propostaToRow), falhas, 'propostas');
  const contratosOk = await upsertTable('hbs_contratos', contratos.map(_mappers.contratoToRow), falhas, 'contratos');
  const historicoOk = await upsertTable('hbs_historico_events', historico.map(_mappers.historicoToRow), falhas, 'histórico');

  if (companyConfig) {
    const { error } = await supabase.from('hbs_app_settings').update({ value: companyConfig as unknown as Database['public']['Tables']['hbs_app_settings']['Row']['value'] }).eq('key', 'company_config');
    if (error) { console.error('[importação única] falha em company_config:', error); falhas.push(`configuração da empresa: ${error.message}`); }
  }
  if (precificacaoConfig) {
    const { error } = await supabase.from('hbs_app_settings').update({ value: precificacaoConfig as unknown as Database['public']['Tables']['hbs_app_settings']['Row']['value'] }).eq('key', 'precificacao_config');
    if (error) { console.error('[importação única] falha em precificacao_config:', error); falhas.push(`precificação: ${error.message}`); }
  }

  return {
    clientes: clientesOk, lancamentos: lancamentosOk, processos: processosOk,
    tarefas: tarefasOk, contas: contasOk, parceiros: parceirosOk,
    documentos: documentosOk, propostas: propostasOk, contratos: contratosOk,
    historico: historicoOk, falhas,
  };
}
