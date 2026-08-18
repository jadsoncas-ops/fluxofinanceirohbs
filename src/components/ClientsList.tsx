import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { getClients, getProcesses, getTransactions } from '@/lib/storage';
import { computeClientFinancials } from '@/lib/financials';
import { cn } from '@/lib/utils';

interface Props {
  refreshSignal?: number;
}

type ClientFilter = 'Todos' | 'Com saldo a receber' | 'Pessoa jurídica';
const FILTERS: ClientFilter[] = ['Todos', 'Com saldo a receber', 'Pessoa jurídica'];

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export function ClientsList({ refreshSignal = 0 }: Props = {}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('Todos');
  const navigate = useNavigate();

  const rows = useMemo(() => {
    void refreshSignal;
    const clients = getClients();
    const processes = getProcesses();
    const transactions = getTransactions();

    return clients.map(c => {
      const fin = computeClientFinancials(c.id, transactions, processes);
      const clientProcesses = processes.filter(p => p.clienteId === c.id && !p.isArchived);
      const clientTxDates = transactions.filter(t => t.clienteId === c.id).map(t => t.updatedAt || 0).filter(Boolean);
      const lastTouch = clientTxDates.length ? Math.max(...clientTxDates) : (c.createdAt || 0);
      return { client: c, fin, andamento: clientProcesses.length, lastTouch };
    });
  }, [refreshSignal]);

  const filtered = rows.filter(r => {
    if (filter === 'Com saldo a receber' && r.fin.aReceber <= 0) return false;
    if (filter === 'Pessoa jurídica' && r.client.tipo !== 'Pessoa jurídica') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesNome = r.client.nome.toLowerCase().includes(q);
      const matchesCidade = (r.client.endereco?.cidade || '').toLowerCase().includes(q);
      if (!matchesNome && !matchesCidade) return false;
    }
    return true;
  });

  function relativeTime(ts: number) {
    if (!ts) return '—';
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days <= 0) return 'hoje';
    if (days === 1) return 'ontem';
    if (days < 14) return `${days} dias`;
    if (days < 60) return `${Math.floor(days / 7)} semanas`;
    return `${Math.floor(days / 30)} meses`;
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap gap-2.5 items-center">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por nome, cidade ou projeto"
          className="flex-1 min-w-[220px] h-9 text-[13px] border-2"
        />
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-9 px-3.5 rounded-lg text-[12.5px] border transition-colors whitespace-nowrap',
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-2 hover:border-hover'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex gap-3.5 px-[18px] py-[11px] border-b border-border bg-surface-2 text-[10.5px] tracking-[.07em] uppercase text-mute-2">
          <span className="flex-[2.4] min-w-0">Cliente</span>
          <span className="flex-[1.6] min-w-0">Em andamento</span>
          <span className="flex-[1.7] min-w-0">Financeiro</span>
          <span className="flex-1 min-w-0 text-right">Último contato</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-[54px] px-5 text-center">
            <div className="text-sm font-semibold">Nenhum cliente com esse filtro.</div>
            <div className="text-xs text-muted-foreground mt-1.5">Ajuste a busca ou cadastre um novo cliente para começar.</div>
            <button onClick={() => { setSearch(''); setFilter('Todos'); }} className="mt-4 h-[34px] px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px]">Limpar filtros</button>
          </div>
        ) : (
          filtered.map(({ client: c, fin, andamento, lastTouch }) => {
            const pct = fin.totalContratado > 0 ? Math.min(100, Math.round((fin.recebido / fin.totalContratado) * 100)) : (fin.recebido > 0 ? 100 : 0);
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/clientes/${c.id}`)}
                className="flex gap-3.5 items-center px-[18px] py-[13px] border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors"
              >
                <div className="flex-[2.4] min-w-0 flex items-center gap-[11px]">
                  <span className="w-[30px] h-[30px] flex-none rounded-full bg-accent-soft text-accent grid place-items-center text-[11px] font-semibold font-mono-hbs">{initials(c.nome)}</span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{c.nome}</div>
                    <div className="text-[11.5px] text-mute-2">{c.tipo || 'Pessoa física'}{c.endereco?.cidade ? ` · ${c.endereco.cidade}` : ''}</div>
                  </div>
                </div>
                <div className="flex-[1.6] min-w-0 text-[12.5px] text-muted-foreground">
                  {andamento > 0 ? `${andamento} projeto${andamento > 1 ? 's' : ''}` : '—'}
                </div>
                <div className="flex-[1.7] min-w-0">
                  <div className="font-mono-hbs text-[12.5px]">
                    {fin.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    <span className="text-mute-3"> / {fin.totalContratado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-1 rounded-[2px] bg-bar-track mt-[5px] overflow-hidden">
                    <div className={cn('h-full rounded-[2px]', pct >= 100 ? 'bg-success' : 'bg-accent')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-right text-[11.5px] text-mute-2 font-mono-hbs">{relativeTime(lastTouch)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
