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

/**
 * Mensagem de boas-vindas — enviada quando um trabalho novo é cadastrado, pra o cliente já saber
 * o que foi contratado e como falar com a empresa. Tom acolhedor, institucional (HBS, não pessoal).
 */
export function montarMensagemBoasVindas(params: {
  clienteNome: string;
  trabalhoObjeto: string;
  empresa: { nome: string; telefone?: string; email?: string; endereco?: string };
}): string {
  const primeiroNome = params.clienteNome.trim().split(' ')[0];
  const contatos = [
    params.empresa.telefone ? `📞 ${params.empresa.telefone}` : null,
    params.empresa.email ? `✉️ ${params.empresa.email}` : null,
    params.empresa.endereco ? `📍 ${params.empresa.endereco}` : null,
  ].filter(Boolean).join('\n');

  return `Olá, ${primeiroNome}! Tudo bem?

Seja bem-vindo(a) à ${params.empresa.nome}! 🎉

Seu trabalho — ${params.trabalhoObjeto} — já está registrado com a gente e vamos dar início à execução.

Qualquer dúvida ao longo do processo, ou se precisar reorganizar alguma data de pagamento, é só nos chamar por aqui mesmo:
${contatos}

Agradecemos a confiança e vamos manter você informado a cada etapa.

Att.,
${params.empresa.nome}`;
}

export function linkWhatsApp(ddd: string, numero: string, mensagem: string): string {
  return `https://wa.me/55${ddd}${numero}?text=${encodeURIComponent(mensagem)}`;
}
