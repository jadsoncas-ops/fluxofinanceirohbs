export interface ItemVencimento {
  descricao: string;
  valor: number;
  trabalho?: string;
}

function fmtMoneyMsg(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Mensagem institucional de lembrete de vencimento — enviada pela HBS (não em nome pessoal),
 * tom profissional e cordial: lembra o compromisso sem soar como cobrança agressiva.
 */
export function montarMensagemLembreteVencimento(params: {
  clienteNome: string;
  data: string;
  itens: ItemVencimento[];
}): string {
  const dataFmt = new Date(params.data + 'T12:00:00').toLocaleDateString('pt-BR');
  const primeiroNome = params.clienteNome.trim().split(' ')[0];
  const total = params.itens.reduce((s, i) => s + i.valor, 0);

  const linhas = params.itens
    .map(i => `📄 ${i.descricao}${i.trabalho ? ` — ${i.trabalho}` : ''}\n💰 ${fmtMoneyMsg(i.valor)}`)
    .join('\n\n');
  const totalLinha = params.itens.length > 1 ? `\n\nTotal: ${fmtMoneyMsg(total)}` : '';

  return `Olá, ${primeiroNome}! Tudo bem?

Aqui é a equipe da HBS Engenharia.

Passando para lembrar de um vencimento agendado para amanhã, ${dataFmt}:

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
