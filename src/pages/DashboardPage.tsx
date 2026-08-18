import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Layers, FileStack, Handshake, Landmark } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getAccounts, getProcesses, getClients, getTasks, getPropostas } from '@/lib/storage';
import { computeAttentionItems, AttentionItem } from '@/lib/attention';
import { TrabalhoEtapa } from '@/lib/types';
import { cn } from '@/lib/utils';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const STAGE_PCT: Record<TrabalhoEtapa, number> = { Planejamento: 15, 'Em andamento': 50, 'Aguardando cliente': 70, Revisão: 88, Concluído: 100 };
const STAGE_COLOR: Record<TrabalhoEtapa, string> = { Planejamento: 'text-mute-2', 'Em andamento': 'text-accent', 'Aguardando cliente': 'text-warning', Revisão: 'text-warning', Concluído: 'text-success' };
const PROXIMA_ACAO: Record<TrabalhoEtapa, string> = { Planejamento: 'Iniciar levantamento', 'Em andamento': 'Continuar produção técnica', 'Aguardando cliente': 'Cobrar retorno do cliente', Revisão: 'Concluir revisão', Concluído: 'Arquivar trabalho' };

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const severityBar: Record<AttentionItem['severity'], string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-mute-3',
};

export default function DashboardPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const { allTransactions: transactions } = shell;

  const { kpis, attention, cashflow, upcoming, continuando, resumo } = useMemo(() => {
    const accounts = getAccounts();
    const processes = getProcesses();
    const clients = getClients();
    const tasks = getTasks();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const saldoDisponivel = accounts.filter(a => a.ativo).reduce((s, a) => s + a.saldo, 0);

    const aReceberTx = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído');
    const aReceber = aReceberTx.reduce((s, t) => s + t.valor, 0);
    const aReceberAtrasado = aReceberTx.filter(t => t.data < today).reduce((s, t) => s + t.valor, 0);

    const receitaMes = transactions
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
      .filter(t => { const d = new Date(t.data + 'T12:00:00'); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, t) => s + t.valor, 0);
    const receitaMesAnterior = transactions
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
      .filter(t => { const d = new Date(t.data + 'T12:00:00'); const prev = new Date(now.getFullYear(), now.getMonth() - 1); return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear(); })
      .reduce((s, t) => s + t.valor, 0);

    const trabalhosAtivos = processes.filter(p => !p.isArchived && (p.etapa || 'Planejamento') !== 'Concluído');
    const aguardandoCliente = trabalhosAtivos.filter(p => p.etapa === 'Aguardando cliente').length;

    const kpis = [
      { label: 'Caixa disponível', value: fmtMoney(saldoDisponivel), color: undefined, hint: accounts.length > 0 ? `${accounts.filter(a => a.ativo).length} conta${accounts.filter(a => a.ativo).length !== 1 ? 's' : ''} · hoje` : 'Cadastre suas contas', to: '/caixa/contas' },
      { label: 'A receber', value: fmtMoney(aReceber), color: aReceber > 0 ? 'text-destructive' : undefined, hint: aReceberAtrasado > 0 ? `${fmtMoney(aReceberAtrasado)} vencidos` : 'Nada vencido agora', to: '/caixa/receitas' },
      { label: 'Receita do mês', value: fmtMoney(receitaMes), color: undefined, hint: receitaMesAnterior > 0 ? `${receitaMes >= receitaMesAnterior ? '+' : '−'}${Math.abs(Math.round(((receitaMes - receitaMesAnterior) / receitaMesAnterior) * 100))}% sobre a média` : 'Sem histórico de comparação', to: '/caixa/visao-geral' },
      { label: 'Trabalhos ativos', value: String(trabalhosAtivos.length), color: undefined, hint: aguardandoCliente > 0 ? `${aguardandoCliente} aguardando cliente` : 'Nenhum parado', to: '/trabalhos' },
      { label: 'Clientes ativos', value: String(clients.length), color: undefined, hint: clients.length === 0 ? 'Cadastre o primeiro cliente' : 'na base', to: '/clientes' },
    ];

    const attention = computeAttentionItems(transactions, clients, tasks, processes, getPropostas());

    const cashflow = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const receita = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getMonth() === d.getMonth() && new Date(t.data + 'T12:00:00').getFullYear() === d.getFullYear()).reduce((s, t) => s + t.valor, 0);
      const despesa = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getMonth() === d.getMonth() && new Date(t.data + 'T12:00:00').getFullYear() === d.getFullYear()).reduce((s, t) => s + t.valor, 0);
      return { mes: MONTHS_SHORT[d.getMonth()], receita, despesa };
    });

    const em15dias = new Date();
    em15dias.setDate(em15dias.getDate() + 15);
    const em15diasStr = em15dias.toISOString().slice(0, 10);

    const upcomingTx = transactions
      .filter(t => t.status !== 'Concluído' && t.data >= today && t.data <= em15diasStr)
      .map(t => {
        const isEntrada = t.tipo === 'Entrada' || t.tipo === 'A Receber';
        const [, m, d] = t.data.split('-');
        return { key: t.id, data: `${d}/${m}`, sortDate: t.data, label: t.descricao, valor: `${isEntrada ? '+' : '−'} ${fmtMoney(t.valor)}`, color: isEntrada ? 'text-success' : 'text-foreground' };
      });
    const upcomingTasks = tasks
      .filter(t => t.status !== 'Concluída' && t.prazo && t.prazo >= today && t.prazo <= em15diasStr)
      .map(t => {
        const [, m, d] = t.prazo!.split('-');
        return { key: t.id, data: `${d}/${m}`, sortDate: t.prazo!, label: t.titulo, valor: 'prazo', color: 'text-mute-2' };
      });
    const upcoming = [...upcomingTx, ...upcomingTasks].sort((a, b) => a.sortDate.localeCompare(b.sortDate)).slice(0, 6);

    const continuando = trabalhosAtivos
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 3)
      .map(p => {
        const etapa = p.etapa || 'Planejamento';
        return {
          id: p.id,
          nome: p.objeto || 'Trabalho',
          endereco: p.endereco || (clients.find(c => c.id === p.clienteId)?.nome ?? ''),
          etapa,
          pct: STAGE_PCT[etapa],
          proximaAcao: PROXIMA_ACAO[etapa],
        };
      });

    const resumo = `${trabalhosAtivos.length} trabalho${trabalhosAtivos.length !== 1 ? 's' : ''} aberto${trabalhosAtivos.length !== 1 ? 's' : ''} · ${attention.length} pendência${attention.length !== 1 ? 's' : ''}`;

    return { kpis, attention, cashflow, upcoming, continuando, resumo };
  }, [transactions]);

  const maxCash = Math.max(1, ...cashflow.flatMap(m => [m.receita, m.despesa]));

  return (
    <div className="flex flex-col gap-[34px] pb-8 animate-hbs-in">
      {/* Saudação */}
      <div>
        <h1 className="text-[28px] font-semibold -tracking-[.028em]">{saudacao()}, Jádson.</h1>
        <p className="text-[14.5px] text-muted-foreground mt-1">Veja o que precisa da sua atenção hoje.</p>
        <p className="text-[12.5px] text-mute-2 font-mono-hbs mt-1.5">{resumo}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => navigate('/trabalhos')} className="h-[34px] px-3.5 bg-card border-2 rounded-lg text-[12.5px] hover:border-hover transition-colors flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Novo trabalho</button>
          <button onClick={() => navigate('/producao')} className="h-[34px] px-3.5 bg-card border-2 rounded-lg text-[12.5px] hover:border-hover transition-colors flex items-center gap-2"><FileStack className="w-3.5 h-3.5" /> Gerar documento</button>
          <button onClick={() => navigate('/comercial')} className="h-[34px] px-3.5 bg-card border-2 rounded-lg text-[12.5px] hover:border-hover transition-colors flex items-center gap-2"><Handshake className="w-3.5 h-3.5" /> Nova proposta</button>
          <button onClick={() => shell.openNovoRecebimento()} className="h-[34px] px-3.5 bg-card border-2 rounded-lg text-[12.5px] hover:border-hover transition-colors flex items-center gap-2"><Landmark className="w-3.5 h-3.5" /> Lançar recebimento</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-px bg-border border border-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(186px, 1fr))' }}>
        {kpis.map(k => (
          <button key={k.label} onClick={() => navigate(k.to)} className="bg-card px-[18px] pt-4 pb-[15px] text-left hover:bg-surface-3 transition-colors">
            <div className="text-[11px] tracking-[.07em] uppercase text-mute-2 font-medium">{k.label}</div>
            <div className={cn('font-mono-hbs text-[24px] font-medium -tracking-[.035em] mt-2.5', k.color)}>{k.value}</div>
            <div className="text-[11.5px] text-muted-foreground mt-1.5 leading-[1.35]">{k.hint}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {/* Precisa da sua atenção */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] py-[15px] border-b border-3 flex items-center justify-between">
            <div>
              <div className="text-[16px] font-semibold">Precisa da sua atenção</div>
              <div className="text-[11.5px] text-mute-2 mt-0.5 font-mono-hbs">ordenado por impacto</div>
            </div>
            <span className="text-[11px] font-mono-hbs text-mute-2">{attention.length} {attention.length === 1 ? 'item' : 'itens'}</span>
          </div>
          {attention.length === 0 ? (
            <div className="px-[18px] py-10 text-center text-sm text-muted-foreground">Nada pendente agora.</div>
          ) : (
            attention.map(a => (
              <div key={a.id} onClick={() => navigate(a.to)} className="flex items-center gap-[13px] px-[18px] py-[13px] border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors">
                <span className={cn('w-[3px] self-stretch rounded-[2px]', severityBar[a.severity])} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-[1.35]">{a.title}</div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">{a.sub}</div>
                </div>
                <span className="flex-none text-[11.5px] font-medium text-accent whitespace-nowrap flex items-center gap-0.5">{a.cta} <ChevronRight className="w-3 h-3" /></span>
              </div>
            ))
          )}
        </section>

        <div className="flex flex-col gap-[18px]">
          {/* Caixa 6 meses */}
          <section className="bg-card border border-border rounded-xl px-[18px] pt-4 pb-[18px]">
            <div className="flex items-baseline justify-between">
              <div className="text-[13.5px] font-semibold">Caixa · últimos 6 meses</div>
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-accent" />Receita</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-bar-expense" />Despesa</span>
              </div>
            </div>
            <div className="flex items-end gap-3.5 h-[148px] mt-[18px]">
              {cashflow.map(m => (
                <div key={m.mes} className="flex-1 flex flex-col items-center gap-2 h-full">
                  <div className="flex-1 w-full flex items-end justify-center gap-1">
                    <div className="w-3 rounded-t-[3px] bg-accent" style={{ height: `${Math.max(2, (m.receita / maxCash) * 100)}%` }} />
                    <div className="w-3 rounded-t-[3px] bg-bar-expense" style={{ height: `${Math.max(2, (m.despesa / maxCash) * 100)}%` }} />
                  </div>
                  <span className="text-[10.5px] text-mute-2 font-mono-hbs">{m.mes}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Próximos compromissos */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-[18px] py-[15px] border-b border-3 text-[13.5px] font-semibold">Próximos compromissos</div>
            {upcoming.length === 0 ? (
              <div className="px-[18px] py-8 text-center text-xs text-muted-foreground">Nada previsto para os próximos 15 dias.</div>
            ) : (
              upcoming.map(u => (
                <div key={u.key} className="flex items-center gap-[13px] px-[18px] py-[11px] border-b border-3 last:border-b-0">
                  <span className="font-mono-hbs text-[11px] text-mute-2 w-[42px] flex-none">{u.data}</span>
                  <span className="text-[12.5px] flex-1 min-w-0 truncate">{u.label}</span>
                  <span className={cn('font-mono-hbs text-[12.5px]', u.color)}>{u.valor}</span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      {/* Continuar trabalhando */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[16px] font-semibold">Continuar trabalhando</div>
          <button onClick={() => navigate('/trabalhos')} className="text-[12px] font-medium text-accent flex items-center gap-1">Ver todos os trabalhos <ChevronRight className="w-3 h-3" /></button>
        </div>
        {continuando.length === 0 ? (
          <div className="bg-card border border-dash border-2 rounded-xl py-12 text-center">
            <p className="text-sm font-medium">Nenhum trabalho em andamento.</p>
            <p className="text-xs text-muted-foreground mt-1">Crie o primeiro trabalho para começar a acompanhar aqui.</p>
            <button onClick={() => navigate('/trabalhos')} className="mt-4 h-[34px] px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] hover:bg-primary-hover transition-colors">+ Novo trabalho</button>
          </div>
        ) : (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(288px, 1fr))' }}>
            {continuando.map(t => (
              <div key={t.id} onClick={() => navigate(`/trabalhos/${t.id}`)} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover transition-all">
                <div className="text-[14px] font-semibold truncate">{t.nome}</div>
                {t.endereco && <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{t.endereco}</div>}
                <div className="flex items-center gap-2 mt-2.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full', STAGE_COLOR[t.etapa].replace('text-', 'bg-'))} />
                  <span className={cn('text-[11.5px] font-medium', STAGE_COLOR[t.etapa])}>{t.etapa}</span>
                  <span className="ml-auto font-mono-hbs text-[11px] text-mute-2">{t.pct}%</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <span key={i} className={cn('h-1 flex-1 rounded-full', i < Math.round((t.pct / 100) * 7) ? 'bg-accent' : 'bg-border')} />
                  ))}
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-3 pt-3 border-t border-3">Próxima ação · <strong className="text-foreground font-medium">{t.proximaAcao}</strong></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
