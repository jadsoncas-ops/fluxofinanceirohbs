import { useMemo, useState } from 'react';
import { useShell } from '@/hooks/use-shell';
import { getCompromissos, getClients, getTasks } from '@/lib/storage';
import { Compromisso } from '@/lib/types';
import { CalendarioAgenda } from '@/components/CalendarioAgenda';
import { NovoCompromissoDialog } from '@/components/dashboard/NovoCompromissoDialog';

/** Módulo Agenda — mesmo CalendarioAgenda.tsx que antes vivia embutido no fim do Dashboard,
 *  agora com rota própria. Sem alteração no componente do calendário em si (semana/mês,
 *  drag-and-drop, popup de dia, compromissos/tarefas/cobranças) nem no diálogo de novo
 *  compromisso — só migraram de página-mãe. */
export default function AgendaPage() {
  const shell = useShell();
  const [compromissoDialogOpen, setCompromissoDialogOpen] = useState(false);
  const [compromissoEditando, setCompromissoEditando] = useState<Compromisso | undefined>(undefined);
  const [novoCompromissoData, setNovoCompromissoData] = useState<string | undefined>(undefined);

  const { compromissos, tasks, clients } = useMemo(() => {
    void shell.refreshKey;
    return { compromissos: getCompromissos(), tasks: getTasks(), clients: getClients() };
  }, [shell.refreshKey]);

  function abrirNovoCompromisso(data?: string) {
    setCompromissoEditando(undefined);
    setNovoCompromissoData(data);
    setCompromissoDialogOpen(true);
  }
  function abrirEditarCompromisso(c: Compromisso) {
    setCompromissoEditando(c);
    setCompromissoDialogOpen(true);
  }

  return (
    <div className="animate-hbs-in">
      <div className="mb-4">
        <h1 className="text-[19px] font-semibold">Agenda</h1>
        <p className="text-[12.5px] text-mute-2 mt-0.5">Compromissos, tarefas e cobranças por dia.</p>
      </div>

      <CalendarioAgenda
        compromissos={compromissos}
        tasks={tasks}
        transactions={shell.allTransactions}
        clients={clients}
        onNovo={abrirNovoCompromisso}
        onEditar={abrirEditarCompromisso}
      />

      <NovoCompromissoDialog
        open={compromissoDialogOpen}
        onClose={() => setCompromissoDialogOpen(false)}
        compromisso={compromissoEditando}
        dataInicial={novoCompromissoData}
      />
    </div>
  );
}
