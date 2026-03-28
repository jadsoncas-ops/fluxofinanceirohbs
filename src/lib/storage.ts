import { Transaction, Client } from './types';

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
      const parts = descMatch.split('-');
      const suffix = parts.length > 1 ? parts[parts.length - 1].trim() : descMatch;
      
      // Find a non-repasse with matching description (could be on different date)
      const parent = nonRepasses.find(p => {
        if (p.tipo !== 'Entrada' && p.tipo !== 'A Receber') return false;
        if (p.descricao === descMatch || p.descricao.includes(descMatch) || descMatch.includes(p.descricao)) return true;
        if (parts.length > 1 && p.descricao.includes(suffix)) return true;
        return false;
      });
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

export function bulkUpdateTransactions(updates: Partial<Transaction> & { id: string }[]): void {
  const all = loadAll();
  updates.forEach(u => {
    const idx = all.findIndex(t => t.id === u.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...u };
    }
  });
  saveAll(all);
}

export function deleteTransaction(id: string): void {
  const all = loadAll();
  
  const toDelete = new Set<string>([id]);
  let added = true;
  
  while (added) {
    added = false;
    for (const tx of all) {
      if (tx.parentId && toDelete.has(tx.parentId) && !toDelete.has(tx.id)) {
        toDelete.add(tx.id);
        added = true;
      }
    }
  }

  const filtered = all.filter(t => !toDelete.has(t.id));
  saveAll(filtered);
}

export function exportBackup(): string {
  return JSON.stringify(loadAll(), null, 2);
}

export function importBackup(json: string): void {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('Formato inválido');
  saveAll(data);
}

// --- CLIENTS CRM ---
const STORAGE_KEY_CLIENTS = 'hbs_clients';

function loadAllClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllClients(clients: Client[]) {
  localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
}

export function getClients(): Client[] {
  return loadAllClients().sort((a, b) => a.nome.localeCompare(b.nome));
}

export function addClient(client: Client): void {
  const all = loadAllClients();
  all.push(client);
  saveAllClients(all);
}

export function updateClient(updated: Client): void {
  const all = loadAllClients();
  const idx = all.findIndex(c => c.id === updated.id);
  if (idx >= 0) all[idx] = updated;
  saveAllClients(all);
}

export function deleteClient(id: string): void {
  const all = loadAllClients();
  const filtered = all.filter(c => c.id !== id);
  saveAllClients(filtered);
}
