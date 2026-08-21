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

  // Ordem respeita as FKs: clientes/parceiros/contas primeiro, depois quem depende delas.
  if (clients.length) await supabase.from('hbs_clients').upsert(clients.map(_mappers.clientToRow));
  if (partners.length) await supabase.from('hbs_partners').upsert(partners.map(_mappers.partnerToRow));
  if (accounts.length) await supabase.from('hbs_accounts').upsert(accounts.map(_mappers.accountToRow));
  if (processes.length) await supabase.from('hbs_processes').upsert(processes.map(_mappers.processToRow));
  if (transactions.length) await supabase.from('hbs_transactions').upsert(transactions.map(_mappers.transactionToRow));
  if (tasks.length) await supabase.from('hbs_tasks').upsert(tasks.map(_mappers.taskToRow));
  if (documents.length) await supabase.from('hbs_documents').upsert(documents.map(_mappers.documentToRow));
  if (propostas.length) await supabase.from('hbs_propostas').upsert(propostas.map(_mappers.propostaToRow));
  if (contratos.length) await supabase.from('hbs_contratos').upsert(contratos.map(_mappers.contratoToRow));
  if (historico.length) await supabase.from('hbs_historico_events').upsert(historico.map(_mappers.historicoToRow));
  if (companyConfig) {
    await supabase.from('hbs_app_settings').update({ value: companyConfig as unknown as Database['public']['Tables']['hbs_app_settings']['Row']['value'] }).eq('key', 'company_config');
  }
  if (precificacaoConfig) {
    await supabase.from('hbs_app_settings').update({ value: precificacaoConfig as unknown as Database['public']['Tables']['hbs_app_settings']['Row']['value'] }).eq('key', 'precificacao_config');
  }

  return {
    clientes: clients.length, lancamentos: transactions.length, processos: processes.length,
    tarefas: tasks.length, contas: accounts.length, parceiros: partners.length,
    documentos: documents.length, propostas: propostas.length, contratos: contratos.length,
    historico: historico.length,
  };
}
