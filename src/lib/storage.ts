import { Transaction } from './types';

const STORAGE_KEY = 'hbs_transactions';

function loadAll(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(txs: Transaction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
}

export function getTransactions(): Transaction[] {
  return loadAll();
}

export function addTransaction(tx: Transaction): void {
  const all = loadAll();
  all.push(tx);
  saveAll(all);
}

export function addTransactions(newTxs: Transaction[]): void {
  const all = loadAll();
  all.push(...newTxs);
  saveAll(all);
}

export function updateTransaction(updated: Transaction): void {
  const all = loadAll();
  const idx = all.findIndex(t => t.id === updated.id);
  if (idx >= 0) all[idx] = updated;
  saveAll(all);
}

export function deleteTransaction(id: string): void {
  const all = loadAll().filter(t => t.id !== id);
  saveAll(all);
}

export function exportBackup(): string {
  return JSON.stringify(loadAll(), null, 2);
}

export function importBackup(json: string): void {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('Formato inválido');
  saveAll(data);
}
