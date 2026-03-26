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

/** Migrate old repasses that have no parentId by matching description patterns */
function migrateOrphanRepasses(txs: Transaction[]): boolean {
  let changed = false;
  const nonRepasses = txs.filter(t => !t.isRepasse);

  txs.forEach(tx => {
    if (tx.isRepasse && !tx.parentId) {
      // Try to match "Repasse - <description>" to a parent
      const descMatch = tx.descricao.replace(/^Repasse\s*-\s*/i, '');
      // Find a non-repasse on the same date with matching description
      const parent = nonRepasses.find(p =>
        p.data === tx.data &&
        (p.descricao === descMatch || p.descricao.includes(descMatch) || descMatch.includes(p.descricao))
      );
      if (parent) {
        tx.parentId = parent.id;
        changed = true;
      }
    }
  });

  return changed;
}

export function getTransactions(): Transaction[] {
  const all = loadAll();
  if (migrateOrphanRepasses(all)) {
    saveAll(all);
  }
  return all;
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
