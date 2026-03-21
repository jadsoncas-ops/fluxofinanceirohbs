import { supabase } from '@/integrations/supabase/client';
import { Transaction } from './types';

// Map DB row to Transaction
function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    data: row.data,
    tipo: row.tipo,
    categoria: row.categoria,
    descricao: row.descricao,
    valor: Number(row.valor),
    status: row.status,
    isRepasse: row.is_repasse,
  };
}

export async function getTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('data', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToTransaction);
}

export async function addTransaction(tx: Transaction): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { error } = await supabase.from('transactions').insert({
    id: tx.id,
    user_id: user.id,
    data: tx.data,
    tipo: tx.tipo,
    categoria: tx.categoria,
    descricao: tx.descricao,
    valor: tx.valor,
    status: tx.status,
    is_repasse: tx.isRepasse,
  });
  if (error) throw error;
}

export async function addTransactions(newTxs: Transaction[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const rows = newTxs.map(tx => ({
    id: tx.id,
    user_id: user.id,
    data: tx.data,
    tipo: tx.tipo,
    categoria: tx.categoria,
    descricao: tx.descricao,
    valor: tx.valor,
    status: tx.status,
    is_repasse: tx.isRepasse,
  }));
  const { error } = await supabase.from('transactions').insert(rows);
  if (error) throw error;
}

export async function updateTransaction(updated: Transaction): Promise<void> {
  const { error } = await supabase.from('transactions').update({
    data: updated.data,
    tipo: updated.tipo,
    categoria: updated.categoria,
    descricao: updated.descricao,
    valor: updated.valor,
    status: updated.status,
    is_repasse: updated.isRepasse,
  }).eq('id', updated.id);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export async function exportBackup(): Promise<string> {
  const txs = await getTransactions();
  return JSON.stringify(txs, null, 2);
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('Formato inválido');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  
  // Clear existing and insert new
  await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (data.length > 0) {
    const rows = data.map((tx: any) => ({
      id: tx.id || crypto.randomUUID(),
      user_id: user.id,
      data: tx.data,
      tipo: tx.tipo,
      categoria: tx.categoria,
      descricao: tx.descricao,
      valor: tx.valor,
      status: tx.status,
      is_repasse: tx.isRepasse ?? tx.is_repasse ?? false,
    }));
    const { error } = await supabase.from('transactions').insert(rows);
    if (error) throw error;
  }
}
