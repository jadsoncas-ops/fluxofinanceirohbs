import { Process, Client, CompanyConfig } from '@/lib/types';
import { proprietariosDoTrabalho } from './documentoShared';

export interface LaudoData {
  nomeTrabalho: string;
  endereco: string;
  responsavel: CompanyConfig;
  art: string;
  nomesProprietarios: string;
  descricaoAmbientes: string;
  fraseInadequacoes: string;
}

/** Laudo de Habitabilidade — portado de cota_saas (lib/documentos/laudo.ts). */
export function montarLaudo(trabalho: Process, cliente: Client | undefined, config: CompanyConfig, inadequacoesConstatadas: string): LaudoData {
  const tecnico = trabalho.tecnico;
  const units = tecnico?.units || [];
  const proprietarios = proprietariosDoTrabalho(trabalho, cliente);
  const nomesProprietarios = proprietarios.map(p => p.nome).filter(Boolean).join(', ') || '(preencha o proprietário)';

  const partes = units.map(u => `${u.pavimento}: ${u.comodos || '(descreva os cômodos ao editar a unidade)'}`);
  const descricaoAmbientes = partes.length ? partes.join('; ') : '(nenhuma unidade cadastrada ainda)';

  const fraseInadequacoes = inadequacoesConstatadas.trim()
    ? `Foi verificado, que o imóvel possui ${inadequacoesConstatadas.trim()}, exigidos pelo presente Código de Obras em vigor.`
    : 'Não foram verificadas inadequações em relação ao Código de Obras em vigor.';

  return {
    nomeTrabalho: trabalho.objeto,
    endereco: trabalho.endereco || '',
    responsavel: config,
    art: tecnico?.art || '',
    nomesProprietarios,
    descricaoAmbientes,
    fraseInadequacoes,
  };
}
