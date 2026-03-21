import { Transaction } from './types';

const STORAGE_KEY = 'financeiro_lancamentos';

export function getTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTransactions(txs: Transaction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
}

export function addTransaction(tx: Transaction): void {
  const txs = getTransactions();
  txs.push(tx);
  saveTransactions(txs);
}

export function addTransactions(newTxs: Transaction[]): void {
  const txs = getTransactions();
  txs.push(...newTxs);
  saveTransactions(txs);
}

export function updateTransaction(updated: Transaction): void {
  const txs = getTransactions().map(t => t.id === updated.id ? updated : t);
  saveTransactions(txs);
}

export function deleteTransaction(id: string): void {
  saveTransactions(getTransactions().filter(t => t.id !== id));
}

export function exportBackup(): string {
  return JSON.stringify(getTransactions(), null, 2);
}

export function importBackup(json: string): void {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('Formato inválido');
  saveTransactions(data);
}
