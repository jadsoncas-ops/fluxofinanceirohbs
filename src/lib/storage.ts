import { Transaction, Client, Process, Task, Account, Partner, DocumentRecord, CompanyConfig, Proposta, Contrato, PrecificacaoConfig, HistoricoEvent, HistoricoModulo } from './types';
import { CUSTOS_FIXOS_PADRAO, CUSTOS_VARIAVEIS_PADRAO, INVESTIMENTOS_PADRAO, HORAS_PRODUTIVAS_PADRAO, CUSTOS_PROTOCOLO_PADRAO } from './comercial/precificacao';

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

export function clearAllTransactions(): void {
  saveAll([]);
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
  const data = {
    lancamentos: loadAll(),
    clientes: loadAllClients(),
    processos: loadAllProcesses(),
    tarefas: loadAllTasks(),
    contas: loadAllAccounts(),
    documentos: loadAllDocuments(),
  };
  return JSON.stringify(data, null, 2);
}

export function importBackup(json: string): void {
  const data = JSON.parse(json);
  
  // Suporte a formato antigo (Apenas array de lançamentos)
  if (Array.isArray(data)) {
    saveAll(data);
    return;
  }

  // Formato Novo (Objeto com clientes e lancamentos)
  if (data && typeof data === 'object') {
    const newTxs: Transaction[] = Array.isArray(data.lancamentos) ? data.lancamentos : [];
    const newClients: Client[] = Array.isArray(data.clientes) ? data.clientes : [];

    // Restaurar Clientes com de-duplicação por ID
    if (newClients.length > 0) {
      const currentClients = loadAllClients();
      const clientsMap = new Map(currentClients.map(c => [c.id, c]));
      
      newClients.forEach(c => {
        clientsMap.set(c.id, c); // Sobrescreve/Adiciona mantendo o ID único
      });
      
      saveAllClients(Array.from(clientsMap.values()));
    }

    // Restaurar Lançamentos (Substituição total para garantir integridade do backup)
    if (Array.isArray(data.lancamentos)) {
      // Validação de vínculo: se o clienteId não existir na base restaurada, garantimos compatibilidade
      const currentClientsAfterRestore = loadAllClients();
      const validClientIds = new Set(currentClientsAfterRestore.map(c => c.id));
      const validatedTxs = newTxs.map(tx => {
        if (tx.clienteId && !validClientIds.has(tx.clienteId)) {
          return { ...tx, clienteId: null }; // Limpa vínculo se o cliente não existe
        }
        return tx;
      });
      saveAll(validatedTxs);
    }

    // Restaurar Processos
    if (Array.isArray(data.processos)) {
      saveAllProcesses(data.processos);
    }

    // Restaurar Tarefas
    if (Array.isArray(data.tarefas)) {
      saveAllTasks(data.tarefas);
    }

    // Restaurar Contas
    if (Array.isArray(data.contas)) {
      saveAllAccounts(data.contas);
    }

    // Restaurar Documentos
    if (Array.isArray(data.documentos)) {
      saveAllDocuments(data.documentos);
    }
  }
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

// --- PROCESSES ---
const STORAGE_KEY_PROCESSES = 'hbs_processes';

function loadAllProcesses(): Process[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROCESSES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllProcesses(procs: Process[]) {
  localStorage.setItem(STORAGE_KEY_PROCESSES, JSON.stringify(procs));
}

export function getProcessByClient(clienteId: string): Process | null {
  const all = loadAllProcesses();
  return all.find(p => p.clienteId === clienteId) || null;
}

export function getProcesses(): Process[] {
  return loadAllProcesses();
}

export function updateProcess(proc: Process): void {
  const all = loadAllProcesses();
  const idx = all.findIndex(p => p.id === proc.id);
  if (idx >= 0) {
    all[idx] = { ...proc, updatedAt: Date.now() };
  } else {
    all.push({ ...proc, createdAt: Date.now(), updatedAt: Date.now() });
  }
  saveAllProcesses(all);
}

export function deleteProcessAndData(clienteId: string): void {
  // 1. Apagar transações vinculadas
  const txs = loadAll();
  const filteredTxs = txs.filter(t => t.clienteId !== clienteId);
  saveAll(filteredTxs);

  // 2. Apagar notas do processo e processo em si
  const procs = loadAllProcesses();
  const filteredProcs = procs.filter(p => p.clienteId !== clienteId);
  saveAllProcesses(filteredProcs);
}

export function deleteProcess(processId: string): void {
  const all = loadAllProcesses();
  const proc = all.find(p => p.id === processId);
  if (!proc) return;

  // Delete transactions: prioritize processId; for legacy (no processId), only delete if it's the last process for this client
  const txs = loadAll();
  const filtered = txs.filter(t => {
    if (t.processId) return t.processId !== processId;
    
    // Legacy check
    const isThisClient = t.clienteId === proc.clienteId;
    const hasOtherProcs = all.some(p => p.clienteId === proc.clienteId && p.id !== processId);
    if (isThisClient && hasOtherProcs) return true; // Keep legacy if other processes exist
    
    return !isThisClient;
  });
  saveAll(filtered);

  // Delete tasks linked to this process
  const tasks = loadAllTasks();
  saveAllTasks(tasks.filter(t => t.processId !== processId));

  // Delete the process itself
  const remaining = all.filter(p => p.id !== processId);
  saveAllProcesses(remaining);
}

// --- TASKS ---
const STORAGE_KEY_TASKS = 'hbs_tasks';

function loadAllTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
}

export function getTasks(): Task[] {
  return loadAllTasks();
}

export function addTask(task: Task): void {
  const all = loadAllTasks();
  all.push(task);
  saveAllTasks(all);
}

export function updateTask(updated: Task): void {
  const all = loadAllTasks();
  const idx = all.findIndex(t => t.id === updated.id);
  if (idx >= 0) all[idx] = updated;
  saveAllTasks(all);
}

export function deleteTask(id: string): void {
  const all = loadAllTasks();
  saveAllTasks(all.filter(t => t.id !== id));
}

// --- ACCOUNTS (Contas financeiras) ---
const STORAGE_KEY_ACCOUNTS = 'hbs_accounts';

function loadAllAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllAccounts(accounts: Account[]) {
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
}

export function getAccounts(): Account[] {
  return loadAllAccounts().sort((a, b) => b.createdAt - a.createdAt);
}

export function addAccount(account: Account): void {
  const all = loadAllAccounts();
  all.push(account);
  saveAllAccounts(all);
}

export function updateAccount(updated: Account): void {
  const all = loadAllAccounts();
  const idx = all.findIndex(a => a.id === updated.id);
  if (idx >= 0) all[idx] = updated;
  saveAllAccounts(all);
}

export function deleteAccount(id: string): void {
  const all = loadAllAccounts();
  saveAllAccounts(all.filter(a => a.id !== id));
}

// --- PARTNERS (Parceiros) ---
const STORAGE_KEY_PARTNERS = 'hbs_partners';

function loadAllPartners(): Partner[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PARTNERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllPartners(partners: Partner[]) {
  localStorage.setItem(STORAGE_KEY_PARTNERS, JSON.stringify(partners));
}

export function getPartners(): Partner[] {
  return loadAllPartners().sort((a, b) => a.nome.localeCompare(b.nome));
}

export function getPartner(id: string): Partner | undefined {
  return loadAllPartners().find(p => p.id === id);
}

export function addPartner(partner: Partner): void {
  const all = loadAllPartners();
  all.push(partner);
  saveAllPartners(all);
}

export function updatePartner(updated: Partner): void {
  const all = loadAllPartners();
  const idx = all.findIndex(p => p.id === updated.id);
  if (idx >= 0) all[idx] = updated;
  saveAllPartners(all);
}

export function deletePartner(id: string): void {
  const all = loadAllPartners();
  saveAllPartners(all.filter(p => p.id !== id));
}

// --- DOCUMENTOS ---
const STORAGE_KEY_DOCUMENTS = 'hbs_documents';

function loadAllDocuments(): DocumentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOCUMENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllDocuments(docs: DocumentRecord[]) {
  localStorage.setItem(STORAGE_KEY_DOCUMENTS, JSON.stringify(docs));
}

export function getDocuments(): DocumentRecord[] {
  return loadAllDocuments().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function addDocument(doc: DocumentRecord): void {
  const all = loadAllDocuments();
  all.push(doc);
  saveAllDocuments(all);
}

export function updateDocument(updated: DocumentRecord): void {
  const all = loadAllDocuments();
  const idx = all.findIndex(d => d.id === updated.id);
  if (idx >= 0) all[idx] = { ...updated, updatedAt: Date.now() };
  saveAllDocuments(all);
}

export function deleteDocument(id: string): void {
  const all = loadAllDocuments();
  saveAllDocuments(all.filter(d => d.id !== id));
}

// --- CONFIGURAÇÃO DA EMPRESA (usada na Produção Técnica e no Comercial) ---
const STORAGE_KEY_COMPANY_CONFIG = 'hbs_company_config';

export function getCompanyConfig(): CompanyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPANY_CONFIG);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveCompanyConfig(config: CompanyConfig): void {
  localStorage.setItem(STORAGE_KEY_COMPANY_CONFIG, JSON.stringify(config));
}

// --- CONFIGURAÇÃO DE PRECIFICAÇÃO (Comercial) ---
const STORAGE_KEY_PRECIFICACAO_CONFIG = 'hbs_precificacao_config';

function defaultPrecificacaoConfig(): PrecificacaoConfig {
  return {
    custosDiretos: [
      { id: 'deslocamento', descricao: 'Deslocamento, combustível e impressões', valor: CUSTOS_VARIAVEIS_PADRAO, tipo: 'variavel' },
    ],
    custosIndiretos: [
      { id: 'estrutura', descricao: 'Aluguel, internet e softwares', valor: CUSTOS_FIXOS_PADRAO, tipo: 'fixo' },
      { id: 'investimentos', descricao: 'Investimentos', valor: INVESTIMENTOS_PADRAO, tipo: 'fixo' },
    ],
    horasDisponiveis: HORAS_PRODUTIVAS_PADRAO,
    horasNaoFaturaveis: 0,
    custosProtocolo: { ...CUSTOS_PROTOCOLO_PADRAO },
    lucroPercentPadrao: 30,
    impostosPercentPadrao: 5,
    comissaoPercentPadrao: 15,
  };
}

export function getPrecificacaoConfig(): PrecificacaoConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRECIFICACAO_CONFIG);
    if (!raw) return defaultPrecificacaoConfig();
    return { ...defaultPrecificacaoConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultPrecificacaoConfig();
  }
}

export function savePrecificacaoConfig(config: PrecificacaoConfig): void {
  localStorage.setItem(STORAGE_KEY_PRECIFICACAO_CONFIG, JSON.stringify(config));
}

// --- COMERCIAL: PROPOSTAS ---
const STORAGE_KEY_PROPOSTAS = 'hbs_propostas';

function loadAllPropostas(): Proposta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROPOSTAS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllPropostas(propostas: Proposta[]) {
  localStorage.setItem(STORAGE_KEY_PROPOSTAS, JSON.stringify(propostas));
}

export function getPropostas(): Proposta[] {
  return loadAllPropostas().sort((a, b) => b.createdAt - a.createdAt);
}

export function getNextPropostaCodigo(): string {
  const all = loadAllPropostas();
  const max = all.reduce((m, p) => {
    const n = parseInt(p.codigo.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 87); // arranca em PRP-0088, seguindo a numeração já usada nos exemplos do handoff
  return `PRP-${String(max + 1).padStart(4, '0')}`;
}

export function addProposta(proposta: Proposta): void {
  const all = loadAllPropostas();
  all.push(proposta);
  saveAllPropostas(all);
}

export function updateProposta(updated: Proposta): void {
  const all = loadAllPropostas();
  const idx = all.findIndex(p => p.id === updated.id);
  if (idx >= 0) all[idx] = { ...updated, updatedAt: Date.now() };
  saveAllPropostas(all);
}

export function deleteProposta(id: string): void {
  const all = loadAllPropostas();
  saveAllPropostas(all.filter(p => p.id !== id));
}

// --- COMERCIAL: CONTRATOS ---
const STORAGE_KEY_CONTRATOS = 'hbs_contratos';

function loadAllContratos(): Contrato[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONTRATOS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllContratos(contratos: Contrato[]) {
  localStorage.setItem(STORAGE_KEY_CONTRATOS, JSON.stringify(contratos));
}

export function getContratos(): Contrato[] {
  return loadAllContratos().sort((a, b) => b.createdAt - a.createdAt);
}

export function getNextContratoCodigo(): string {
  const all = loadAllContratos();
  const max = all.reduce((m, c) => {
    const n = parseInt(c.codigo.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 57); // arranca em CTR-0058, seguindo a numeração já usada nos exemplos do handoff
  return `CTR-${String(max + 1).padStart(4, '0')}`;
}

export function addContrato(contrato: Contrato): void {
  const all = loadAllContratos();
  all.push(contrato);
  saveAllContratos(all);
}

export function updateContrato(updated: Contrato): void {
  const all = loadAllContratos();
  const idx = all.findIndex(c => c.id === updated.id);
  if (idx >= 0) all[idx] = { ...updated, updatedAt: Date.now() };
  saveAllContratos(all);
}

export function getContrato(id: string): Contrato | null {
  return loadAllContratos().find(c => c.id === id) || null;
}

export function getProposta(id: string): Proposta | null {
  return loadAllPropostas().find(p => p.id === id) || null;
}

// --- HISTÓRICO (linha do tempo integrada) ---
const STORAGE_KEY_HISTORICO = 'hbs_historico';

function loadAllHistorico(): HistoricoEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORICO);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllHistorico(events: HistoricoEvent[]) {
  localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(events));
}

export function getHistorico(filter?: { clienteId?: string; trabalhoId?: string }): HistoricoEvent[] {
  let all = loadAllHistorico().sort((a, b) => b.createdAt - a.createdAt);
  if (filter?.clienteId) all = all.filter(e => e.clienteId === filter.clienteId);
  if (filter?.trabalhoId) all = all.filter(e => e.trabalhoId === filter.trabalhoId);
  return all;
}

export function registrarEvento(evento: Omit<HistoricoEvent, 'id' | 'createdAt'>): void {
  const all = loadAllHistorico();
  all.push({ ...evento, id: crypto.randomUUID(), createdAt: Date.now() });
  // mantém só os últimos 500 eventos — histórico é uma timeline de leitura, não um log de auditoria
  saveAllHistorico(all.slice(-500));
}
