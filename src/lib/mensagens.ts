export interface ItemVencimento {
  descricao: string;
  valor: number;
  trabalho?: string;
  data: string; // YYYY-MM-DD
}

function fmtMoneyMsg(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function situacaoItem(data: string, hojeStr: string): string {
  const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
  if (data < hojeStr) return `vencido em ${dataFmt}`;
  if (data === hojeStr) return `vence hoje, ${dataFmt}`;
  return `vence em ${dataFmt}`;
}

/**
 * Mensagem institucional de lembrete/cobrança — enviada pela HBS (não em nome pessoal), tom
 * profissional e cordial. Adapta a abertura conforme haja ou não item já vencido na lista.
 */
export function montarMensagemLembreteVencimento(params: {
  clienteNome: string;
  itens: ItemVencimento[];
}): string {
  const hojeStr = new Date().toISOString().slice(0, 10);
  const primeiroNome = params.clienteNome.trim().split(' ')[0];
  const total = params.itens.reduce((s, i) => s + i.valor, 0);
  const temVencido = params.itens.some(i => i.data < hojeStr);

  const linhas = params.itens
    .map(i => `📄 ${i.descricao}${i.trabalho ? ` — ${i.trabalho}` : ''}\n💰 ${fmtMoneyMsg(i.valor)} · ${situacaoItem(i.data, hojeStr)}`)
    .join('\n\n');
  const totalLinha = params.itens.length > 1 ? `\n\nTotal: ${fmtMoneyMsg(total)}` : '';
  const abertura = temVencido
    ? 'Passando para lembrar de um compromisso financeiro em aberto:'
    : 'Passando para lembrar de um vencimento agendado:';

  return `Olá, ${primeiroNome}! Tudo bem?

Aqui é a equipe da HBS Engenharia.

${abertura}

${linhas}${totalLinha}

Se o pagamento já estiver programado, pode desconsiderar este aviso — é só um lembrete de rotina, combinado?

Qualquer dúvida ou necessidade de reorganizar a data, é só nos chamar por aqui mesmo. Estamos à disposição.

Agradecemos a confiança e a parceria!

Att.,
HBS Engenharia`;
}

export function linkWhatsApp(ddd: string, numero: string, mensagem: string): string {
  return `https://wa.me/55${ddd}${numero}?text=${encodeURIComponent(mensagem)}`;
}
