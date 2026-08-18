import { Proposta, Contrato, ContratoParcela, Process, Transaction, TrabalhoEtapa } from '@/lib/types';
import {
  updateProposta, addContrato, getNextContratoCodigo, getContrato, updateContrato,
  updateProcess, getProcesses, addTransaction, registrarEvento,
} from '@/lib/storage';

/**
 * Aprova uma proposta e gera o contrato correspondente — nunca duplica cliente/dados,
 * só referencia o que já existe. O contrato nasce sem trabalho vinculado ainda;
 * isso acontece em criarTrabalhoDoContrato, quando as parcelas são definidas.
 */
export function aprovarPropostaEGerarContrato(proposta: Proposta): Contrato {
  const propostaAtualizada: Proposta = { ...proposta, status: 'Aprovada', updatedAt: Date.now() };
  updateProposta(propostaAtualizada);

  const contrato: Contrato = {
    id: crypto.randomUUID(),
    codigo: getNextContratoCodigo(),
    propostaId: proposta.id,
    clienteId: proposta.clienteId,
    trabalhoId: null,
    valor: proposta.resultado.precoVenda,
    parcelas: [],
    status: 'Ativo',
    assinadoEm: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  addContrato(contrato);

  registrarEvento({
    modulo: 'Comercial',
    texto: `Proposta ${proposta.codigo} aprovada`,
    clienteId: proposta.clienteId,
    propostaId: proposta.id,
  });
  registrarEvento({
    modulo: 'Comercial',
    texto: `Contrato ${contrato.codigo} criado — R$ ${contrato.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    clienteId: proposta.clienteId,
    propostaId: proposta.id,
    contratoId: contrato.id,
  });

  return contrato;
}

export interface ParcelaInput {
  descricao: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
}

export interface NovoTrabalhoInput {
  tipoTrabalho: string;
  endereco?: string;
  prazo?: string; // YYYY-MM-DD
  parcelas: ParcelaInput[];
}

/**
 * Transforma um contrato aprovado em Trabalho real. O Trabalho herda cliente, título
 * (da proposta) e valor contratado — nada é recadastrado. Cada parcela vira um
 * lançamento financeiro (A Receber, Pendente) já vinculado a cliente + trabalho,
 * então o Fluxo de Caixa passa a enxergá-las como previstas automaticamente.
 */
export function criarTrabalhoDoContrato(contratoId: string, proposta: Proposta, input: NovoTrabalhoInput): Process {
  const contrato = getContrato(contratoId);
  if (!contrato) throw new Error('Contrato não encontrado.');

  const now = Date.now();
  const trabalho: Process = {
    id: crypto.randomUUID(),
    clienteId: contrato.clienteId,
    objeto: proposta.titulo,
    status: 'Levantamento',
    etapa: 'Planejamento' as TrabalhoEtapa,
    tipoTrabalho: input.tipoTrabalho,
    endereco: input.endereco,
    prazo: input.prazo,
    valorContrato: contrato.valor,
    notas: [],
    contratoId: contrato.id,
    createdAt: now,
    updatedAt: now,
  };
  updateProcess(trabalho); // updateProcess faz upsert por id — como o id é novo, isso insere

  const parcelasComTransacao: ContratoParcela[] = input.parcelas.map(p => {
    const tx: Transaction = {
      id: crypto.randomUUID(),
      data: p.vencimento,
      tipo: 'A Receber',
      categoria: '📐 Elaboração de Projeto',
      descricao: `${p.descricao} — ${trabalho.objeto}`,
      valor: p.valor,
      status: 'Pendente',
      isRepasse: false,
      clienteId: trabalho.clienteId,
      processId: trabalho.id,
    };
    addTransaction(tx);
    return { id: crypto.randomUUID(), descricao: p.descricao, valor: p.valor, vencimento: p.vencimento, transactionId: tx.id };
  });

  const contratoAtualizado: Contrato = { ...contrato, trabalhoId: trabalho.id, parcelas: parcelasComTransacao, updatedAt: now };
  updateContrato(contratoAtualizado);

  const propostaAtualizada: Proposta = { ...proposta, trabalhoId: trabalho.id, updatedAt: now };
  updateProposta(propostaAtualizada);

  registrarEvento({
    modulo: 'Trabalhos',
    texto: `Trabalho "${trabalho.objeto}" criado a partir do contrato ${contrato.codigo}`,
    clienteId: trabalho.clienteId,
    trabalhoId: trabalho.id,
    contratoId: contrato.id,
  });
  if (parcelasComTransacao.length > 0) {
    registrarEvento({
      modulo: 'Financeiro',
      texto: `${parcelasComTransacao.length} parcela${parcelasComTransacao.length > 1 ? 's' : ''} prevista${parcelasComTransacao.length > 1 ? 's' : ''} — total de R$ ${contrato.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      clienteId: trabalho.clienteId,
      trabalhoId: trabalho.id,
      contratoId: contrato.id,
    });
  }

  return trabalho;
}

/** Trabalhos que ainda não existem — usado pra saber se um contrato já pode oferecer "Criar Trabalho". */
export function contratoPodeGerarTrabalho(contrato: Contrato): boolean {
  return !contrato.trabalhoId;
}
