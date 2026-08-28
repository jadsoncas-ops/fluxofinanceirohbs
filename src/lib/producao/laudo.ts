import { Process, Client, CompanyConfig } from '@/lib/types';
import { proprietariosDoTrabalho } from './documentoShared';

export interface LaudoData {
  nomeTrabalho: string;
  endereco: string;
  responsavel: CompanyConfig;
  art: string;
  nomesProprietarios: string;
  /** Vazio quando omitirDescricaoUnidades está marcado — a frase no documento se reorganiza pra
   *  não deixar um "com" solto no meio do texto. */
  descricaoAmbientes: string;
  fraseInadequacoes: string;
  /** Só preenchida quando a construção é anterior a 2015 (anterior ao atual Código de Obras) —
   *  vazia (sem frase nenhuma) quando não se aplica, pra não forçar um "não se aplica" estranho no texto. */
  fraseEpocaConstrucao: string;
}

/** Laudo de Habitabilidade — portado de cota_saas (lib/documentos/laudo.ts). */
export function montarLaudo(
  trabalho: Process,
  cliente: Client | undefined,
  config: CompanyConfig,
  inadequacoesConstatadas: string,
  construidoAntes2015 = false,
  omitirDescricaoUnidades = false
): LaudoData {
  const tecnico = trabalho.tecnico;
  const units = tecnico?.units || [];
  const proprietarios = proprietariosDoTrabalho(trabalho, cliente);
  const nomesProprietarios = proprietarios.map(p => p.nome).filter(Boolean).join(', ') || '(preencha o proprietário)';

  const partes = units.map(u => `${u.pavimento}: ${u.comodos || '(descreva os cômodos ao editar a unidade)'}`);
  const descricaoAmbientes = omitirDescricaoUnidades ? '' : (partes.length ? partes.join('; ') : '(nenhuma unidade cadastrada ainda)');

  const fraseInadequacoes = inadequacoesConstatadas.trim()
    ? `Foi verificado, que o imóvel possui ${inadequacoesConstatadas.trim()}, exigidos pelo presente Código de Obras em vigor.`
    : 'Não foram verificadas inadequações em relação ao Código de Obras em vigor.';

  const fraseEpocaConstrucao = construidoAntes2015
    ? 'Ressalta-se que a edificação foi executada em data anterior ao ano de 2015, portanto anterior à vigência do atual Código de Obras do Município, sendo-lhe aplicáveis, quanto aos parâmetros construtivos, as normas técnicas e urbanísticas vigentes à época de sua execução.'
    : '';

  return {
    nomeTrabalho: trabalho.objeto,
    endereco: trabalho.endereco || '',
    responsavel: config,
    art: tecnico?.art || '',
    nomesProprietarios,
    descricaoAmbientes,
    fraseInadequacoes,
    fraseEpocaConstrucao,
  };
}
