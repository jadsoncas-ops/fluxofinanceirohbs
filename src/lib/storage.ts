import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  Transaction, Client, Process, Task, Account, Partner, DocumentRecord,
  CompanyConfig, Proposta, Contrato, PrecificacaoConfig, HistoricoEvent, Compromisso, AvaliacaoAluguel,
} from './types';
import { CUSTOS_FIXOS_PADRAO, CUSTOS_VARIAVEIS_PADRAO, INVESTIMENTOS_PADRAO, HORAS_PRODUTIVAS_PADRAO, CUSTOS_PROTOCOLO_PADRAO } from './comercial/precificacao';

// ============================================================================
// Dados de negócio vivem no Supabase (multi-dispositivo, tempo real). Este
// módulo mantém um cache em memória + a mesma API síncrona que o resto do
// app já usa (getX()/addX()/updateX()/deleteX()) — só troca o motor por
// dentro. Escritas são otimistas (cache atualiza na hora, Supabase grava em
// paralelo); se a gravação falhar, mostra um toast e re-sincroniza a tabela
// inteira a partir do servidor.
// ============================================================================

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

interface Cache {
  transactions: Transaction[];
  clients: Client[];
  processes: Process[];
  tasks: Task[];
  accounts: Account[];
  partners: Partner[];
  documents: DocumentRecord[];
  propostas: Proposta[];
  contratos: Contrato[];
  historico: HistoricoEvent[];
  compromissos: Compromisso[];
  avaliacoes: AvaliacaoAluguel[];
  companyConfig: CompanyConfig;
  precificacaoConfig: PrecificacaoConfig | null;
}

const cache: Cache = {
  transactions: [], clients: [], processes: [], tasks: [], accounts: [],
  partners: [], documents: [], propostas: [], contratos: [], historico: [],
  compromissos: [], avaliacoes: [], companyConfig: {}, precificacaoConfig: null,
};

let bootstrapPromise: Promise<void> | null = null;
let ready = false;

type Listener = () => void;
const listeners = new Set<Listener>();
export function onStorageChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  listeners.forEach(cb => cb());
}

export function isStorageReady(): boolean {
  return ready;
}

// ----------------------------------------------------------------------------
// Mapeamento linha (snake_case/Postgres) <-> tipo do app (camelCase)
// ----------------------------------------------------------------------------

function rowToTransaction(r: Row<'hbs_transactions'>): Transaction {
  return {
    id: r.id,
    data: r.data,
    tipo: r.tipo as Transaction['tipo'],
    categoria: r.categoria,
    descricao: r.descricao,
    valor: Number(r.valor),
    status: r.status as Transaction['status'],
    isRepasse: r.is_repasse,
    parentId: r.parent_id ?? undefined,
    partnerId: r.partner_id,
    clienteId: r.cliente_id,
    processId: r.process_id ?? undefined,
    previsaoData: r.previsao_data ?? undefined,
    updatedAt: r.updated_at !== r.created_at ? new Date(r.updated_at).getTime() : undefined,
    originalTotal: r.original_total != null ? Number(r.original_total) : undefined,
  };
}
function transactionToRow(t: Transaction): Database['public']['Tables']['hbs_transactions']['Insert'] {
  return {
    id: t.id, data: t.data, tipo: t.tipo, categoria: t.categoria, descricao: t.descricao,
    valor: t.valor, status: t.status, is_repasse: t.isRepasse, parent_id: t.parentId ?? null,
    partner_id: t.partnerId ?? null, cliente_id: t.clienteId ?? null, process_id: t.processId ?? null,
    previsao_data: t.previsaoData ?? null, original_total: t.originalTotal ?? null,
  };
}

function rowToClient(r: Row<'hbs_clients'>): Client {
  return {
    id: r.id, nome: r.nome, tipo: r.tipo as Client['tipo'],
    documento: r.documento, telefone: r.telefone as Client['telefone'],
    endereco: r.endereco as Client['endereco'], descricao: r.descricao,
    qualificacao: r.qualificacao as Client['qualificacao'],
    lembretesCobranca: (r.lembretes_cobranca as number[] | null) ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  };
}
function clientToRow(c: Client): Database['public']['Tables']['hbs_clients']['Insert'] {
  return {
    id: c.id, nome: c.nome, tipo: c.tipo ?? null, documento: c.documento ?? null,
    telefone: c.telefone ?? null, endereco: c.endereco ?? null, descricao: c.descricao ?? null,
    qualificacao: c.qualificacao ?? null,
    lembretes_cobranca: (c.lembretesCobranca ?? []) as Database['public']['Tables']['hbs_clients']['Insert']['lembretes_cobranca'],
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
  };
}

function rowToProcess(r: Row<'hbs_processes'>): Process {
  return {
    id: r.id, clienteId: r.cliente_id, objeto: r.objeto, status: r.status as Process['status'],
    etapa: r.etapa as Process['etapa'], tipoTrabalho: r.tipo_trabalho ?? undefined,
    endereco: r.endereco ?? undefined, prazo: r.prazo ?? undefined, protocolo: r.protocolo ?? undefined,
    dataProtocolo: r.data_protocolo ?? undefined, valorContrato: r.valor_contrato != null ? Number(r.valor_contrato) : undefined,
    driveLink: r.drive_link ?? undefined, isArchived: r.is_archived, notas: (r.notas as Process['notas']) ?? [],
    tecnico: r.tecnico as Process['tecnico'], contratoId: r.contrato_id ?? undefined,
    averbacao: r.averbacao as Process['averbacao'],
    procuracao: r.procuracao as Process['procuracao'],
    cartaReforma: r.carta_reforma as Process['cartaReforma'],
    anuencia: r.anuencia as Process['anuencia'],
    descarteEntulhos: r.descarte_entulhos as Process['descarteEntulhos'],
    registro: (r.registro as Process['registro']) ?? undefined,
    createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  };
}
function processToRow(p: Process): Database['public']['Tables']['hbs_processes']['Insert'] {
  return {
    id: p.id, cliente_id: p.clienteId, objeto: p.objeto, status: p.status, etapa: p.etapa ?? null,
    tipo_trabalho: p.tipoTrabalho ?? null, endereco: p.endereco ?? null, prazo: p.prazo ?? null,
    protocolo: p.protocolo ?? null, data_protocolo: p.dataProtocolo ?? null,
    valor_contrato: p.valorContrato ?? null, drive_link: p.driveLink ?? null, is_archived: !!p.isArchived,
    notas: (p.notas ?? []) as Database['public']['Tables']['hbs_processes']['Insert']['notas'],
    tecnico: (p.tecnico ?? null) as Database['public']['Tables']['hbs_processes']['Insert']['tecnico'],
    contrato_id: p.contratoId ?? null,
    averbacao: (p.averbacao ?? null) as Database['public']['Tables']['hbs_processes']['Insert']['averbacao'],
    procuracao: (p.procuracao ?? null) as Database['public']['Tables']['hbs_processes']['Insert']['procuracao'],
    carta_reforma: (p.cartaReforma ?? null) as Database['public']['Tables']['hbs_processes']['Insert']['carta_reforma'],
    anuencia: (p.anuencia ?? null) as Database['public']['Tables']['hbs_processes']['Insert']['anuencia'],
    descarte_entulhos: (p.descarteEntulhos ?? null) as Database['public']['Tables']['hbs_processes']['Insert']['descarte_entulhos'],
    registro: (p.registro ?? null) as Database['public']['Tables']['hbs_processes']['Insert']['registro'],
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
    updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined,
  };
}

function rowToTask(r: Row<'hbs_tasks'>): Task {
  return {
    id: r.id, titulo: r.titulo, descricao: r.descricao ?? undefined, status: r.status as Task['status'],
    prioridade: r.prioridade as Task['prioridade'], prazo: r.prazo ?? undefined, processId: r.process_id,
    clienteId: r.cliente_id, createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
    completedAt: r.completed_at ? new Date(r.completed_at).getTime() : undefined,
  };
}
function taskToRow(t: Task): Database['public']['Tables']['hbs_tasks']['Insert'] {
  return {
    id: t.id, titulo: t.titulo, descricao: t.descricao ?? null, status: t.status, prioridade: t.prioridade,
    prazo: t.prazo ?? null, process_id: t.processId ?? null, cliente_id: t.clienteId ?? null,
    completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
    created_at: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
    updated_at: t.updatedAt ? new Date(t.updatedAt).toISOString() : undefined,
  };
}

function rowToAccount(r: Row<'hbs_accounts'>): Account {
  return { id: r.id, nome: r.nome, tipo: r.tipo as Account['tipo'], saldo: Number(r.saldo), ativo: r.ativo, createdAt: new Date(r.created_at).getTime() };
}
function accountToRow(a: Account): Database['public']['Tables']['hbs_accounts']['Insert'] {
  return { id: a.id, nome: a.nome, tipo: a.tipo, saldo: a.saldo, ativo: a.ativo, created_at: a.createdAt ? new Date(a.createdAt).toISOString() : undefined };
}

function rowToPartner(r: Row<'hbs_partners'>): Partner {
  return { id: r.id, nome: r.nome, documento: r.documento, contato: r.contato, observacao: r.observacao, createdAt: new Date(r.created_at).getTime() };
}
function partnerToRow(p: Partner): Database['public']['Tables']['hbs_partners']['Insert'] {
  return { id: p.id, nome: p.nome, documento: p.documento ?? null, contato: p.contato ?? null, observacao: p.observacao ?? null, created_at: p.createdAt ? new Date(p.createdAt).toISOString() : undefined };
}

function rowToDocument(r: Row<'hbs_documents'>): DocumentRecord {
  return {
    id: r.id, nome: r.nome, clienteId: r.cliente_id, processId: r.process_id,
    tipoTecnico: r.tipo_tecnico as DocumentRecord['tipoTecnico'], versao: r.versao ?? undefined,
    situacao: r.situacao as DocumentRecord['situacao'], link: r.link ?? undefined,
    createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  };
}
function documentToRow(d: DocumentRecord): Database['public']['Tables']['hbs_documents']['Insert'] {
  return {
    id: d.id, nome: d.nome, cliente_id: d.clienteId ?? null, process_id: d.processId ?? null,
    tipo_tecnico: d.tipoTecnico ?? null, versao: d.versao ?? null, situacao: d.situacao, link: d.link ?? null,
    created_at: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
    updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : undefined,
  };
}

function rowToProposta(r: Row<'hbs_propostas'>): Proposta {
  return {
    id: r.id, codigo: r.codigo, clienteId: r.cliente_id, trabalhoId: r.trabalho_id,
    titulo: r.titulo, itens: (r.itens as Proposta['itens']) ?? [], custoHoraBase: Number(r.custo_hora_base),
    lucroPercent: Number(r.lucro_percent), impostosPercent: Number(r.impostos_percent),
    comissaoPercent: Number(r.comissao_percent), custosProtocolo: r.custos_protocolo as Proposta['custosProtocolo'],
    resultado: r.resultado as Proposta['resultado'], prazoDias: r.prazo_dias ?? undefined,
    formaPagamento: r.forma_pagamento ?? undefined, parcelasPagamento: r.parcelas_pagamento as Proposta['parcelasPagamento'],
    observacaoParceiro: r.observacao_parceiro ?? undefined,
    status: r.status as Proposta['status'], enviadaEm: r.enviada_em ? new Date(r.enviada_em).getTime() : undefined,
    createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  };
}
function propostaToRow(p: Proposta): Database['public']['Tables']['hbs_propostas']['Insert'] {
  return {
    id: p.id, codigo: p.codigo, cliente_id: p.clienteId, trabalho_id: p.trabalhoId ?? null,
    titulo: p.titulo, itens: p.itens as Database['public']['Tables']['hbs_propostas']['Insert']['itens'],
    custo_hora_base: p.custoHoraBase, lucro_percent: p.lucroPercent, impostos_percent: p.impostosPercent,
    comissao_percent: p.comissaoPercent,
    custos_protocolo: (p.custosProtocolo ?? null) as Database['public']['Tables']['hbs_propostas']['Insert']['custos_protocolo'],
    resultado: p.resultado as Database['public']['Tables']['hbs_propostas']['Insert']['resultado'],
    prazo_dias: p.prazoDias ?? null, forma_pagamento: p.formaPagamento ?? null,
    parcelas_pagamento: (p.parcelasPagamento ?? null) as Database['public']['Tables']['hbs_propostas']['Insert']['parcelas_pagamento'],
    observacao_parceiro: p.observacaoParceiro ?? null,
    status: p.status, enviada_em: p.enviadaEm ? new Date(p.enviadaEm).toISOString() : null,
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
    updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined,
  };
}

function rowToContrato(r: Row<'hbs_contratos'>): Contrato {
  return {
    id: r.id, codigo: r.codigo, propostaId: r.proposta_id, clienteId: r.cliente_id, trabalhoId: r.trabalho_id,
    valor: Number(r.valor), parcelas: (r.parcelas as Contrato['parcelas']) ?? [], status: r.status as Contrato['status'],
    assinadoEm: r.assinado_em ? new Date(r.assinado_em).getTime() : undefined,
    createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  };
}
function contratoToRow(c: Contrato): Database['public']['Tables']['hbs_contratos']['Insert'] {
  return {
    id: c.id, codigo: c.codigo, proposta_id: c.propostaId, cliente_id: c.clienteId, trabalho_id: c.trabalhoId ?? null,
    valor: c.valor, parcelas: c.parcelas as Database['public']['Tables']['hbs_contratos']['Insert']['parcelas'],
    status: c.status, assinado_em: c.assinadoEm ? new Date(c.assinadoEm).toISOString() : null,
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
    updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : undefined,
  };
}

function rowToHistorico(r: Row<'hbs_historico_events'>): HistoricoEvent {
  return {
    id: r.id, modulo: r.modulo as HistoricoEvent['modulo'], texto: r.texto, clienteId: r.cliente_id,
    trabalhoId: r.trabalho_id, propostaId: r.proposta_id, contratoId: r.contrato_id,
    createdAt: new Date(r.created_at).getTime(),
  };
}
function historicoToRow(h: HistoricoEvent): Database['public']['Tables']['hbs_historico_events']['Insert'] {
  return {
    id: h.id, modulo: h.modulo, texto: h.texto, cliente_id: h.clienteId ?? null,
    trabalho_id: h.trabalhoId ?? null, proposta_id: h.propostaId ?? null, contrato_id: h.contratoId ?? null,
    created_at: h.createdAt ? new Date(h.createdAt).toISOString() : undefined,
  };
}

function rowToCompromisso(r: Row<'hbs_compromissos'>): Compromisso {
  return {
    id: r.id, titulo: r.titulo, data: r.data, horaInicio: r.hora_inicio?.slice(0, 5) ?? undefined,
    horaFim: r.hora_fim?.slice(0, 5) ?? undefined, comQuem: r.com_quem ?? undefined,
    clienteId: r.cliente_id, processId: r.process_id ?? undefined, cor: r.cor,
    createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  };
}
function compromissoToRow(c: Compromisso): Database['public']['Tables']['hbs_compromissos']['Insert'] {
  return {
    id: c.id, titulo: c.titulo, data: c.data, hora_inicio: c.horaInicio || null, hora_fim: c.horaFim || null,
    com_quem: c.comQuem || null, cliente_id: c.clienteId ?? null, process_id: c.processId ?? null, cor: c.cor,
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
    updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : undefined,
  };
}

function rowToAvaliacao(r: Row<'hbs_avaliacoes'>): AvaliacaoAluguel {
  return {
    id: r.id,
    logoUrl: r.logo_url ?? undefined,
    entidadeSolicitante: r.entidade_solicitante ?? undefined,
    secretariaSolicitante: r.secretaria_solicitante ?? undefined,
    secretariaDestinataria: r.secretaria_destinataria ?? undefined,
    tipoLaudo: r.tipo_laudo ?? undefined,
    finalidade: r.finalidade ?? undefined,
    enderecoImovel: r.endereco_imovel ?? undefined,
    municipioUf: r.municipio_uf ?? undefined,
    grauFundamentacao: r.grau_fundamentacao ?? undefined,
    proprietario: r.proprietario ?? undefined,
    metodologiaAplicada: r.metodologia_aplicada ?? undefined,
    tipoImovel: r.tipo_imovel ?? undefined,
    areaConstruida: r.area_construida != null ? Number(r.area_construida) : undefined,
    dataReferencia: r.data_referencia ?? undefined,
    destinacaoUso: r.destinacao_uso ?? undefined,
    usoPredominante: r.uso_predominante ?? undefined,
    tipologia: r.tipologia ?? undefined,
    numeroPavimentos: r.numero_pavimentos ?? undefined,
    padraoConstrutivo: r.padrao_construtivo ?? undefined,
    estadoConservacao: r.estado_conservacao ?? undefined,
    observacoesAdicionais: r.observacoes_adicionais ?? undefined,
    responsavelNome: r.responsavel_nome ?? undefined,
    responsavelRegistro: r.responsavel_registro ?? undefined,
    colaboradorNome: r.colaborador_nome ?? undefined,
    colaboradorRegistro: r.colaborador_registro ?? undefined,
    avaliadorNome: r.avaliador_nome ?? undefined,
    avaliadorRegistro: r.avaliador_registro ?? undefined,
    fatorRedutorPercent: r.fator_redutor_percent != null ? Number(r.fator_redutor_percent) : 10,
    comparaveis: (r.comparaveis as AvaliacaoAluguel['comparaveis']) ?? [],
    fotos: (r.fotos as AvaliacaoAluguel['fotos']) ?? [],
    fotosPorPagina: (r.fotos_por_pagina as AvaliacaoAluguel['fotosPorPagina']) ?? '4',
    cidadeAssinatura: r.cidade_assinatura ?? undefined,
    dataAssinatura: r.data_assinatura ?? undefined,
    status: (r.status as AvaliacaoAluguel['status']) ?? 'Rascunho',
    createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  };
}
function avaliacaoToRow(a: AvaliacaoAluguel): Database['public']['Tables']['hbs_avaliacoes']['Insert'] {
  return {
    id: a.id,
    logo_url: a.logoUrl ?? null,
    entidade_solicitante: a.entidadeSolicitante ?? null,
    secretaria_solicitante: a.secretariaSolicitante ?? null,
    secretaria_destinataria: a.secretariaDestinataria ?? null,
    tipo_laudo: a.tipoLaudo ?? null,
    finalidade: a.finalidade ?? null,
    endereco_imovel: a.enderecoImovel ?? null,
    municipio_uf: a.municipioUf ?? null,
    grau_fundamentacao: a.grauFundamentacao ?? null,
    proprietario: a.proprietario ?? null,
    metodologia_aplicada: a.metodologiaAplicada ?? null,
    tipo_imovel: a.tipoImovel ?? null,
    area_construida: a.areaConstruida ?? null,
    data_referencia: a.dataReferencia ?? null,
    destinacao_uso: a.destinacaoUso ?? null,
    uso_predominante: a.usoPredominante ?? null,
    tipologia: a.tipologia ?? null,
    numero_pavimentos: a.numeroPavimentos ?? null,
    padrao_construtivo: a.padraoConstrutivo ?? null,
    estado_conservacao: a.estadoConservacao ?? null,
    observacoes_adicionais: a.observacoesAdicionais ?? null,
    responsavel_nome: a.responsavelNome ?? null,
    responsavel_registro: a.responsavelRegistro ?? null,
    colaborador_nome: a.colaboradorNome ?? null,
    colaborador_registro: a.colaboradorRegistro ?? null,
    avaliador_nome: a.avaliadorNome ?? null,
    avaliador_registro: a.avaliadorRegistro ?? null,
    fator_redutor_percent: a.fatorRedutorPercent,
    comparaveis: (a.comparaveis ?? []) as Database['public']['Tables']['hbs_avaliacoes']['Insert']['comparaveis'],
    fotos: (a.fotos ?? []) as Database['public']['Tables']['hbs_avaliacoes']['Insert']['fotos'],
    fotos_por_pagina: a.fotosPorPagina ?? '4',
    cidade_assinatura: a.cidadeAssinatura ?? null,
    data_assinatura: a.dataAssinatura ?? null,
    status: a.status,
    created_at: a.createdAt ? new Date(a.createdAt).toISOString() : undefined,
    updated_at: a.updatedAt ? new Date(a.updatedAt).toISOString() : undefined,
  };
}

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

// ----------------------------------------------------------------------------
// Bootstrap + Realtime
// ----------------------------------------------------------------------------

export function bootstrapStorage(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const [tx, cl, pr, tk, ac, pa, doc, prop, con, hist, settings, comp, aval] = await Promise.all([
      supabase.from('hbs_transactions').select('*'),
      supabase.from('hbs_clients').select('*'),
      supabase.from('hbs_processes').select('*'),
      supabase.from('hbs_tasks').select('*'),
      supabase.from('hbs_accounts').select('*'),
      supabase.from('hbs_partners').select('*'),
      supabase.from('hbs_documents').select('*'),
      supabase.from('hbs_propostas').select('*'),
      supabase.from('hbs_contratos').select('*'),
      supabase.from('hbs_historico_events').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('hbs_app_settings').select('*'),
      supabase.from('hbs_compromissos').select('*'),
      supabase.from('hbs_avaliacoes').select('*'),
    ]);
    cache.transactions = (tx.data ?? []).map(rowToTransaction);
    cache.clients = (cl.data ?? []).map(rowToClient);
    cache.processes = (pr.data ?? []).map(rowToProcess);
    cache.tasks = (tk.data ?? []).map(rowToTask);
    cache.accounts = (ac.data ?? []).map(rowToAccount);
    cache.partners = (pa.data ?? []).map(rowToPartner);
    cache.documents = (doc.data ?? []).map(rowToDocument);
    cache.propostas = (prop.data ?? []).map(rowToProposta);
    cache.contratos = (con.data ?? []).map(rowToContrato);
    cache.historico = (hist.data ?? []).map(rowToHistorico);
    cache.compromissos = (comp.data ?? []).map(rowToCompromisso);
    cache.avaliacoes = (aval.data ?? []).map(rowToAvaliacao);

    const settingsMap = new Map((settings.data ?? []).map(s => [s.key, s.value]));
    cache.companyConfig = (settingsMap.get('company_config') as CompanyConfig) ?? {};
    cache.precificacaoConfig = { ...defaultPrecificacaoConfig(), ...((settingsMap.get('precificacao_config') as Partial<PrecificacaoConfig>) ?? {}) };

    ready = true;
    subscribeRealtime();
    notify();
  })();
  return bootstrapPromise;
}

function applyChange<T extends { id: string }>(arr: T[], eventType: string, row: T): T[] {
  if (eventType === 'DELETE') return arr.filter(x => x.id !== row.id);
  const idx = arr.findIndex(x => x.id === row.id);
  if (idx >= 0) { const copy = [...arr]; copy[idx] = row; return copy; }
  return [...arr, row];
}

function subscribeRealtime() {
  supabase
    .channel('hbs-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_transactions' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_transactions'>;
      cache.transactions = applyChange(cache.transactions, payload.eventType, rowToTransaction(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_clients' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_clients'>;
      cache.clients = applyChange(cache.clients, payload.eventType, rowToClient(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_processes' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_processes'>;
      cache.processes = applyChange(cache.processes, payload.eventType, rowToProcess(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_tasks' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_tasks'>;
      cache.tasks = applyChange(cache.tasks, payload.eventType, rowToTask(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_accounts' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_accounts'>;
      cache.accounts = applyChange(cache.accounts, payload.eventType, rowToAccount(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_partners' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_partners'>;
      cache.partners = applyChange(cache.partners, payload.eventType, rowToPartner(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_documents' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_documents'>;
      cache.documents = applyChange(cache.documents, payload.eventType, rowToDocument(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_propostas' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_propostas'>;
      cache.propostas = applyChange(cache.propostas, payload.eventType, rowToProposta(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_contratos' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_contratos'>;
      cache.contratos = applyChange(cache.contratos, payload.eventType, rowToContrato(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_historico_events' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_historico_events'>;
      cache.historico = applyChange(cache.historico, payload.eventType, rowToHistorico(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_app_settings' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_app_settings'>;
      if (row.key === 'company_config') cache.companyConfig = (row.value as CompanyConfig) ?? {};
      if (row.key === 'precificacao_config') cache.precificacaoConfig = { ...defaultPrecificacaoConfig(), ...((row.value as Partial<PrecificacaoConfig>) ?? {}) };
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_compromissos' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_compromissos'>;
      cache.compromissos = applyChange(cache.compromissos, payload.eventType, rowToCompromisso(row));
      notify();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hbs_avaliacoes' }, payload => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row<'hbs_avaliacoes'>;
      cache.avaliacoes = applyChange(cache.avaliacoes, payload.eventType, rowToAvaliacao(row));
      notify();
    })
    .subscribe();
}

async function resyncTable<Name extends keyof Database['public']['Tables'], T extends { id: string }>(
  table: Name,
  mapRow: (r: Row<Name>) => T,
  setCache: (rows: T[]) => void,
) {
  const { data } = await supabase.from(table).select('*');
  setCache(((data ?? []) as Row<Name>[]).map(mapRow));
  notify();
}

function reportError(err: unknown, msg: string) {
  console.error(err);
  toast.error(msg);
}

// ----------------------------------------------------------------------------
// Transactions
// ----------------------------------------------------------------------------

export function getTransactions(): Transaction[] {
  return cache.transactions;
}

export function addTransaction(tx: Transaction): void {
  cache.transactions = [...cache.transactions, tx];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_transactions').insert(transactionToRow(tx));
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_transactions', rowToTransaction, v => cache.transactions = v); }
  })();
}

export function addTransactions(newTxs: Transaction[]): void {
  cache.transactions = [...cache.transactions, ...newTxs];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_transactions').insert(newTxs.map(transactionToRow));
    if (error) { reportError(error, 'Não foi possível salvar alguns lançamentos. Sincronizando novamente…'); await resyncTable('hbs_transactions', rowToTransaction, v => cache.transactions = v); }
  })();
}

export function clearAllTransactions(): void {
  cache.transactions = [];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_transactions').delete().not('id', 'is', null);
    if (error) reportError(error, 'Não foi possível apagar todos os lançamentos.');
  })();
}

export function updateTransaction(updated: Transaction): void {
  const idx = cache.transactions.findIndex(t => t.id === updated.id);
  if (idx >= 0) { const copy = [...cache.transactions]; copy[idx] = updated; cache.transactions = copy; notify(); }
  void (async () => {
    const { error } = await supabase.from('hbs_transactions').update(transactionToRow(updated)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_transactions', rowToTransaction, v => cache.transactions = v); }
  })();
}

export function bulkUpdateTransactions(updates: (Partial<Transaction> & { id: string })[]): void {
  cache.transactions = cache.transactions.map(t => {
    const u = updates.find(x => x.id === t.id);
    return u ? { ...t, ...u } : t;
  });
  notify();
  void (async () => {
    let failed = false;
    for (const u of updates) {
      const current = cache.transactions.find(t => t.id === u.id);
      if (!current) continue;
      const { error } = await supabase.from('hbs_transactions').update(transactionToRow(current)).eq('id', u.id);
      if (error) { console.error(error); failed = true; }
    }
    if (failed) { toast.error('Não foi possível salvar algumas alterações. Sincronizando novamente…'); await resyncTable('hbs_transactions', rowToTransaction, v => cache.transactions = v); }
  })();
}

export function deleteTransaction(id: string): void {
  const all = cache.transactions;
  const toDelete = new Set<string>([id]);
  let added = true;
  while (added) {
    added = false;
    for (const tx of all) {
      if (tx.parentId && toDelete.has(tx.parentId) && !toDelete.has(tx.id)) { toDelete.add(tx.id); added = true; }
    }
  }
  cache.transactions = all.filter(t => !toDelete.has(t.id));
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_transactions').delete().in('id', Array.from(toDelete));
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_transactions', rowToTransaction, v => cache.transactions = v); }
  })();
}

// ----------------------------------------------------------------------------
// Backup manual (exportar/importar JSON) — opera sobre o cache atual
// ----------------------------------------------------------------------------

export function exportBackup(): string {
  const data = {
    lancamentos: cache.transactions,
    clientes: cache.clients,
    processos: cache.processes,
    tarefas: cache.tasks,
    contas: cache.accounts,
    documentos: cache.documents,
    parceiros: cache.partners,
    propostas: cache.propostas,
    contratos: cache.contratos,
    historico: cache.historico,
    companyConfig: cache.companyConfig,
    precificacaoConfig: cache.precificacaoConfig,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Assíncrona e sequencial de propósito: clientes/contas antes de processos, processos antes de
 * lançamentos/tarefas/documentos — essas tabelas têm FK pra `cliente_id`/`process_id`, então
 * gravar tudo em paralelo arrisca uma tabela tentar referenciar uma linha que ainda não existe.
 */
export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json);

  if (Array.isArray(data)) {
    // Formato antigo: array cru de lançamentos
    for (const tx of data as Transaction[]) addTransaction(tx);
    return;
  }
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data.contas)) {
    cache.accounts = data.contas;
    notify();
    const { error } = await supabase.from('hbs_accounts').upsert((data.contas as Account[]).map(accountToRow));
    if (error) reportError(error, 'Não foi possível importar todas as contas.');
  }

  if (Array.isArray(data.clientes)) {
    const existing = new Map(cache.clients.map(c => [c.id, c]));
    (data.clientes as Client[]).forEach(c => existing.set(c.id, c));
    const merged = Array.from(existing.values());
    cache.clients = merged;
    notify();
    const { error } = await supabase.from('hbs_clients').upsert(merged.map(clientToRow));
    if (error) reportError(error, 'Não foi possível importar todos os clientes.');
  }

  if (Array.isArray(data.processos)) {
    cache.processes = data.processos;
    notify();
    const { error } = await supabase.from('hbs_processes').upsert((data.processos as Process[]).map(processToRow));
    if (error) reportError(error, 'Não foi possível importar todos os processos.');
  }

  if (Array.isArray(data.lancamentos)) {
    const validClientIds = new Set(cache.clients.map(c => c.id));
    const validated: Transaction[] = (data.lancamentos as Transaction[]).map(tx =>
      tx.clienteId && !validClientIds.has(tx.clienteId) ? { ...tx, clienteId: null } : tx
    );
    cache.transactions = validated;
    notify();
    const { error } = await supabase.from('hbs_transactions').upsert(validated.map(transactionToRow));
    if (error) reportError(error, 'Não foi possível importar todos os lançamentos.');
  }
  if (Array.isArray(data.tarefas)) {
    cache.tasks = data.tarefas;
    notify();
    const { error } = await supabase.from('hbs_tasks').upsert((data.tarefas as Task[]).map(taskToRow));
    if (error) reportError(error, 'Não foi possível importar todas as tarefas.');
  }
  if (Array.isArray(data.documentos)) {
    cache.documents = data.documentos;
    notify();
    const { error } = await supabase.from('hbs_documents').upsert((data.documentos as DocumentRecord[]).map(documentToRow));
    if (error) reportError(error, 'Não foi possível importar todos os documentos.');
  }
}

// ----------------------------------------------------------------------------
// Clients
// ----------------------------------------------------------------------------

export function getClients(): Client[] {
  return [...cache.clients].sort((a, b) => a.nome.localeCompare(b.nome));
}

export function addClient(client: Client): void {
  cache.clients = [...cache.clients, client];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_clients').insert(clientToRow(client));
    if (error) { reportError(error, 'Não foi possível salvar o cliente. Sincronizando novamente…'); await resyncTable('hbs_clients', rowToClient, v => cache.clients = v); }
  })();
}

export function updateClient(updated: Client): void {
  cache.clients = cache.clients.map(c => c.id === updated.id ? updated : c);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_clients').update(clientToRow(updated)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_clients', rowToClient, v => cache.clients = v); }
  })();
}

export function deleteClient(id: string): void {
  cache.clients = cache.clients.filter(c => c.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_clients').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_clients', rowToClient, v => cache.clients = v); }
  })();
}

// ----------------------------------------------------------------------------
// Processes (Trabalhos)
// ----------------------------------------------------------------------------

export function getProcessByClient(clienteId: string): Process | null {
  return cache.processes.find(p => p.clienteId === clienteId) || null;
}

export function getProcesses(): Process[] {
  return cache.processes;
}

export function updateProcess(proc: Process): void {
  const now = Date.now();
  const idx = cache.processes.findIndex(p => p.id === proc.id);
  let toSave: Process;
  if (idx >= 0) {
    toSave = { ...proc, updatedAt: now };
    const copy = [...cache.processes]; copy[idx] = toSave; cache.processes = copy;
  } else {
    toSave = { ...proc, createdAt: proc.createdAt || now, updatedAt: now };
    cache.processes = [...cache.processes, toSave];
  }
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_processes').upsert(processToRow(toSave));
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_processes', rowToProcess, v => cache.processes = v); }
  })();
}

export function deleteProcessAndData(clienteId: string): void {
  cache.transactions = cache.transactions.filter(t => t.clienteId !== clienteId);
  cache.processes = cache.processes.filter(p => p.clienteId !== clienteId);
  notify();
  void (async () => {
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('hbs_transactions').delete().eq('cliente_id', clienteId),
      supabase.from('hbs_processes').delete().eq('cliente_id', clienteId),
    ]);
    if (e1 || e2) {
      reportError(e1 || e2, 'Alguns dados podem não ter sido removidos. Sincronizando novamente…');
      await Promise.all([
        resyncTable('hbs_transactions', rowToTransaction, v => cache.transactions = v),
        resyncTable('hbs_processes', rowToProcess, v => cache.processes = v),
      ]);
    }
  })();
}

export function deleteProcess(processId: string): void {
  const proc = cache.processes.find(p => p.id === processId);
  if (!proc) return;
  cache.transactions = cache.transactions.filter(t => t.processId !== processId);
  cache.tasks = cache.tasks.filter(t => t.processId !== processId);
  cache.processes = cache.processes.filter(p => p.id !== processId);
  notify();
  void (async () => {
    // ON DELETE CASCADE em transactions.process_id e tasks.process_id cuida do resto no servidor.
    const { error } = await supabase.from('hbs_processes').delete().eq('id', processId);
    if (error) {
      reportError(error, 'Não foi possível excluir. Sincronizando novamente…');
      await Promise.all([
        resyncTable('hbs_processes', rowToProcess, v => cache.processes = v),
        resyncTable('hbs_transactions', rowToTransaction, v => cache.transactions = v),
        resyncTable('hbs_tasks', rowToTask, v => cache.tasks = v),
      ]);
    }
  })();
}

// ----------------------------------------------------------------------------
// Tasks
// ----------------------------------------------------------------------------

export function getTasks(): Task[] {
  return cache.tasks;
}

export function addTask(task: Task): void {
  cache.tasks = [...cache.tasks, task];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_tasks').insert(taskToRow(task));
    if (error) { reportError(error, 'Não foi possível salvar a tarefa. Sincronizando novamente…'); await resyncTable('hbs_tasks', rowToTask, v => cache.tasks = v); }
  })();
}

export function updateTask(updated: Task): void {
  cache.tasks = cache.tasks.map(t => t.id === updated.id ? updated : t);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_tasks').update(taskToRow(updated)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_tasks', rowToTask, v => cache.tasks = v); }
  })();
}

export function deleteTask(id: string): void {
  cache.tasks = cache.tasks.filter(t => t.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_tasks').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_tasks', rowToTask, v => cache.tasks = v); }
  })();
}

// ----------------------------------------------------------------------------
// Accounts (Contas financeiras)
// ----------------------------------------------------------------------------

export function getAccounts(): Account[] {
  return [...cache.accounts].sort((a, b) => b.createdAt - a.createdAt);
}

export function addAccount(account: Account): void {
  cache.accounts = [...cache.accounts, account];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_accounts').insert(accountToRow(account));
    if (error) { reportError(error, 'Não foi possível salvar a conta. Sincronizando novamente…'); await resyncTable('hbs_accounts', rowToAccount, v => cache.accounts = v); }
  })();
}

export function updateAccount(updated: Account): void {
  cache.accounts = cache.accounts.map(a => a.id === updated.id ? updated : a);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_accounts').update(accountToRow(updated)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_accounts', rowToAccount, v => cache.accounts = v); }
  })();
}

export function deleteAccount(id: string): void {
  cache.accounts = cache.accounts.filter(a => a.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_accounts').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_accounts', rowToAccount, v => cache.accounts = v); }
  })();
}

// ----------------------------------------------------------------------------
// Partners (Parceiros)
// ----------------------------------------------------------------------------

export function getPartners(): Partner[] {
  return [...cache.partners].sort((a, b) => a.nome.localeCompare(b.nome));
}

export function getPartner(id: string): Partner | undefined {
  return cache.partners.find(p => p.id === id);
}

export function addPartner(partner: Partner): void {
  cache.partners = [...cache.partners, partner];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_partners').insert(partnerToRow(partner));
    if (error) { reportError(error, 'Não foi possível salvar o parceiro. Sincronizando novamente…'); await resyncTable('hbs_partners', rowToPartner, v => cache.partners = v); }
  })();
}

export function updatePartner(updated: Partner): void {
  cache.partners = cache.partners.map(p => p.id === updated.id ? updated : p);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_partners').update(partnerToRow(updated)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_partners', rowToPartner, v => cache.partners = v); }
  })();
}

export function deletePartner(id: string): void {
  cache.partners = cache.partners.filter(p => p.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_partners').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_partners', rowToPartner, v => cache.partners = v); }
  })();
}

// ----------------------------------------------------------------------------
// Documentos
// ----------------------------------------------------------------------------

export function getDocuments(): DocumentRecord[] {
  return [...cache.documents].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function addDocument(doc: DocumentRecord): void {
  cache.documents = [...cache.documents, doc];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_documents').insert(documentToRow(doc));
    if (error) { reportError(error, 'Não foi possível salvar o documento. Sincronizando novamente…'); await resyncTable('hbs_documents', rowToDocument, v => cache.documents = v); }
  })();
}

export function updateDocument(updated: DocumentRecord): void {
  const withTimestamp = { ...updated, updatedAt: Date.now() };
  cache.documents = cache.documents.map(d => d.id === updated.id ? withTimestamp : d);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_documents').update(documentToRow(withTimestamp)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_documents', rowToDocument, v => cache.documents = v); }
  })();
}

export function deleteDocument(id: string): void {
  cache.documents = cache.documents.filter(d => d.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_documents').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_documents', rowToDocument, v => cache.documents = v); }
  })();
}

// ----------------------------------------------------------------------------
// Configuração da empresa e de precificação (app_settings)
// ----------------------------------------------------------------------------

export function getCompanyConfig(): CompanyConfig {
  return cache.companyConfig;
}

export function saveCompanyConfig(config: CompanyConfig): void {
  cache.companyConfig = config;
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_app_settings').update({ value: config as Database['public']['Tables']['hbs_app_settings']['Row']['value'] }).eq('key', 'company_config');
    if (error) reportError(error, 'Não foi possível salvar as configurações da empresa.');
  })();
}

export function getPrecificacaoConfig(): PrecificacaoConfig {
  return cache.precificacaoConfig ?? defaultPrecificacaoConfig();
}

export function savePrecificacaoConfig(config: PrecificacaoConfig): void {
  cache.precificacaoConfig = config;
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_app_settings').update({ value: config as unknown as Database['public']['Tables']['hbs_app_settings']['Row']['value'] }).eq('key', 'precificacao_config');
    if (error) reportError(error, 'Não foi possível salvar a precificação.');
  })();
}

// ----------------------------------------------------------------------------
// Comercial: Propostas
// ----------------------------------------------------------------------------

export function getPropostas(): Proposta[] {
  return [...cache.propostas].sort((a, b) => b.createdAt - a.createdAt);
}

/** Gera a partir do cache local — colisão exigiria 2 dispositivos criando propostas
 *  no mesmíssimo instante, risco baixo pra um escritório de 2 pessoas.
 *  Numeração reiniciada a pedido do usuário: só conta códigos já no formato novo de 3
 *  dígitos (PRP-001, PRP-002...) — propostas antigas em formato de 4 dígitos (PRP-0089)
 *  ficam intactas como histórico, sem interferir na contagem nova. */
export function getNextPropostaCodigo(): string {
  const max = cache.propostas.reduce((m, p) => {
    const match = p.codigo.match(/^PRP-(\d{3})$/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `PRP-${String(max + 1).padStart(3, '0')}`;
}

export function addProposta(proposta: Proposta): void {
  cache.propostas = [...cache.propostas, proposta];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_propostas').insert(propostaToRow(proposta));
    if (error) { reportError(error, 'Não foi possível salvar a proposta. Sincronizando novamente…'); await resyncTable('hbs_propostas', rowToProposta, v => cache.propostas = v); }
  })();
}

export function updateProposta(updated: Proposta): void {
  const withTs = { ...updated, updatedAt: Date.now() };
  cache.propostas = cache.propostas.map(p => p.id === updated.id ? withTs : p);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_propostas').update(propostaToRow(withTs)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_propostas', rowToProposta, v => cache.propostas = v); }
  })();
}

export function deleteProposta(id: string): void {
  cache.propostas = cache.propostas.filter(p => p.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_propostas').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_propostas', rowToProposta, v => cache.propostas = v); }
  })();
}

// ----------------------------------------------------------------------------
// Comercial: Contratos
// ----------------------------------------------------------------------------

export function getContratos(): Contrato[] {
  return [...cache.contratos].sort((a, b) => b.createdAt - a.createdAt);
}

export function getNextContratoCodigo(): string {
  const max = cache.contratos.reduce((m, c) => {
    const n = parseInt(c.codigo.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 57);
  return `CTR-${String(max + 1).padStart(4, '0')}`;
}

export function addContrato(contrato: Contrato): void {
  cache.contratos = [...cache.contratos, contrato];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_contratos').insert(contratoToRow(contrato));
    if (error) { reportError(error, 'Não foi possível salvar o contrato. Sincronizando novamente…'); await resyncTable('hbs_contratos', rowToContrato, v => cache.contratos = v); }
  })();
}

export function updateContrato(updated: Contrato): void {
  const withTs = { ...updated, updatedAt: Date.now() };
  cache.contratos = cache.contratos.map(c => c.id === updated.id ? withTs : c);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_contratos').update(contratoToRow(withTs)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_contratos', rowToContrato, v => cache.contratos = v); }
  })();
}

export function deleteContrato(id: string): void {
  cache.contratos = cache.contratos.filter(c => c.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_contratos').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_contratos', rowToContrato, v => cache.contratos = v); }
  })();
}

export function getContrato(id: string): Contrato | null {
  return cache.contratos.find(c => c.id === id) || null;
}

export function getProposta(id: string): Proposta | null {
  return cache.propostas.find(p => p.id === id) || null;
}

// ----------------------------------------------------------------------------
// Histórico (linha do tempo integrada)
// ----------------------------------------------------------------------------

export function getHistorico(filter?: { clienteId?: string; trabalhoId?: string }): HistoricoEvent[] {
  let all = [...cache.historico].sort((a, b) => b.createdAt - a.createdAt);
  if (filter?.clienteId) all = all.filter(e => e.clienteId === filter.clienteId);
  if (filter?.trabalhoId) all = all.filter(e => e.trabalhoId === filter.trabalhoId);
  return all;
}

export function registrarEvento(evento: Omit<HistoricoEvent, 'id' | 'createdAt'>): void {
  const novo: HistoricoEvent = { ...evento, id: crypto.randomUUID(), createdAt: Date.now() };
  cache.historico = [novo, ...cache.historico].slice(0, 500);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_historico_events').insert(historicoToRow(novo));
    if (error) console.error(error);
  })();
}

// ----------------------------------------------------------------------------
// Compromissos (agenda semanal — reunião/visita com horário)
// ----------------------------------------------------------------------------

export function getCompromissos(): Compromisso[] {
  return cache.compromissos;
}

export function addCompromisso(compromisso: Compromisso): void {
  cache.compromissos = [...cache.compromissos, compromisso];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_compromissos').insert(compromissoToRow(compromisso));
    if (error) { reportError(error, 'Não foi possível salvar o compromisso. Sincronizando novamente…'); await resyncTable('hbs_compromissos', rowToCompromisso, v => cache.compromissos = v); }
  })();
}

export function updateCompromisso(updated: Compromisso): void {
  const withTs = { ...updated, updatedAt: Date.now() };
  cache.compromissos = cache.compromissos.map(c => c.id === updated.id ? withTs : c);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_compromissos').update(compromissoToRow(withTs)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_compromissos', rowToCompromisso, v => cache.compromissos = v); }
  })();
}

export function deleteCompromisso(id: string): void {
  cache.compromissos = cache.compromissos.filter(c => c.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_compromissos').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_compromissos', rowToCompromisso, v => cache.compromissos = v); }
  })();
}

// ----------------------------------------------------------------------------
// Avaliações de aluguel (Prefeitura/CIUB)
// ----------------------------------------------------------------------------

export function getAvaliacoes(): AvaliacaoAluguel[] {
  return cache.avaliacoes;
}

export function addAvaliacao(avaliacao: AvaliacaoAluguel): void {
  cache.avaliacoes = [...cache.avaliacoes, avaliacao];
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_avaliacoes').insert(avaliacaoToRow(avaliacao));
    if (error) { reportError(error, 'Não foi possível salvar a avaliação. Sincronizando novamente…'); await resyncTable('hbs_avaliacoes', rowToAvaliacao, v => cache.avaliacoes = v); }
  })();
}

export function updateAvaliacao(updated: AvaliacaoAluguel): void {
  const withTs = { ...updated, updatedAt: Date.now() };
  cache.avaliacoes = cache.avaliacoes.map(a => a.id === updated.id ? withTs : a);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_avaliacoes').update(avaliacaoToRow(withTs)).eq('id', updated.id);
    if (error) { reportError(error, 'Não foi possível salvar. Sincronizando novamente…'); await resyncTable('hbs_avaliacoes', rowToAvaliacao, v => cache.avaliacoes = v); }
  })();
}

export function deleteAvaliacao(id: string): void {
  cache.avaliacoes = cache.avaliacoes.filter(a => a.id !== id);
  notify();
  void (async () => {
    const { error } = await supabase.from('hbs_avaliacoes').delete().eq('id', id);
    if (error) { reportError(error, 'Não foi possível excluir. Sincronizando novamente…'); await resyncTable('hbs_avaliacoes', rowToAvaliacao, v => cache.avaliacoes = v); }
  })();
}

// Reexportados para o utilitário de importação única (src/lib/localImport.ts)
export const _mappers = {
  transactionToRow, clientToRow, processToRow, taskToRow, accountToRow,
  partnerToRow, documentToRow, propostaToRow, contratoToRow, historicoToRow,
};
