export const FINANCIAL_TIPS: string[] = [
  "Separe sempre 20% de cada projeto para o fundo de reserva dos seus filhos.",
  "Antes de iniciar uma obra, formalize um contrato com cronograma de pagamentos.",
  "Mantenha uma reserva de emergência equivalente a 6 meses de despesas fixas.",
  "Registre cada deslocamento a obra — combustível é uma despesa que se acumula silenciosamente.",
  "Renegociar taxas de emolumentos pode gerar economia de 5-15% ao longo do ano.",
  "Diversifique suas fontes de receita: projetos, vistorias e regularizações.",
  "Nunca misture finanças pessoais com as do escritório de engenharia.",
  "Invista em educação financeira: livros e cursos compensam mais que qualquer aplicação.",
  "Crie uma meta anual de poupança e reveja-a trimestralmente.",
  "Automatize a reserva: transfira no dia que receber, não no final do mês.",
  "Documente cada repasse a parceiros para evitar conflitos futuros.",
  "A regularização de imóveis é um mercado crescente — invista em networking com cartórios.",
  "Um fundo de reserva robusto protege seus filhos contra imprevistos profissionais.",
  "Considere seguros profissionais: o custo é baixo comparado ao risco.",
  "Planeje antecipadamente o material escolar e atividades extracurriculares dos seus filhos.",
  "Revise mensalmente seus custos fixos — pequenos cortes fazem grande diferença.",
  "Negocie prazos com fornecedores para melhorar o fluxo de caixa.",
  "Mantenha um calendário de vencimentos visível — evite multas desnecessárias.",
  "Reinvista parte do lucro em ferramentas e software que aumentem a produtividade.",
  "Ao precificar um projeto, inclua sempre uma margem para imprevistos de 10-15%.",
  "Avalie periodicamente se o valor das suas vistorias acompanha a inflação.",
  "Tenha uma conta exclusiva para impostos — evite surpresas no final do período fiscal.",
  "Priorize projetos com pagamento adiantado ou parcelado com entrada.",
  "A reputação é seu maior ativo: entregue sempre no prazo acordado.",
  "Considere parcerias estratégicas com despachantes para otimizar o fluxo de trabalho.",
  "Reserve tempo para analisar suas finanças semanalmente — 30 minutos bastam.",
  "Invista em previdência privada como complemento ao INSS para segurança dos filhos.",
  "Mantenha seus documentos organizados digitalmente — backup é essencial.",
  "Antes de aceitar um projeto, calcule o custo-hora real incluindo deslocamentos.",
  "Construir patrimônio é uma maratona, não um sprint. Consistência supera grandes apostas.",
];

export function getTipOfDay(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return FINANCIAL_TIPS[dayOfYear % FINANCIAL_TIPS.length];
}
