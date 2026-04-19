import { useEffect, useState, useMemo } from 'react';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { LayoutDashboard, Briefcase, Users, ListTodo, Settings as SettingsIcon, Plus, FileText, Receipt } from 'lucide-react';
import { getClients, getProcesses, getTasks } from '@/lib/storage';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: 'dashboard' | 'financeiro' | 'processos' | 'clients' | 'tasks' | 'settings') => void;
  onNewTask: () => void;
}

export function CommandPalette({ open, onOpenChange, onNavigate, onNewTask }: Props) {
  const [snapshot, setSnapshot] = useState<{ clients: any[]; processes: any[]; tasks: any[] }>({ clients: [], processes: [], tasks: [] });

  useEffect(() => {
    if (open) {
      setSnapshot({
        clients: getClients(),
        processes: getProcesses(),
        tasks: getTasks().filter(t => t.status !== 'Concluída'),
      });
    }
  }, [open]);

  const processItems = useMemo(() => {
    return snapshot.processes.slice(0, 10).map((p: any) => {
      const c = snapshot.clients.find((c: any) => c.id === p.clienteId);
      return { ...p, displayName: `${c?.nome || '?'} — ${p.objeto || 'Serviço'}` };
    });
  }, [snapshot]);

  function go(tab: any) {
    onOpenChange(false);
    onNavigate(tab);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar processo, cliente, tarefa ou ir para uma seção..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go('dashboard')}><LayoutDashboard className="w-4 h-4 mr-2" />Dashboard</CommandItem>
          <CommandItem onSelect={() => go('processos')}><Briefcase className="w-4 h-4 mr-2" />Processos</CommandItem>
          <CommandItem onSelect={() => go('tasks')}><ListTodo className="w-4 h-4 mr-2" />Tarefas</CommandItem>
          <CommandItem onSelect={() => go('clients')}><Users className="w-4 h-4 mr-2" />Clientes</CommandItem>
          <CommandItem onSelect={() => go('settings')}><SettingsIcon className="w-4 h-4 mr-2" />Definições</CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => { onOpenChange(false); onNewTask(); }}>
            <Plus className="w-4 h-4 mr-2" />Nova Tarefa
          </CommandItem>
          <CommandItem onSelect={() => go('processos')}>
            <Plus className="w-4 h-4 mr-2" />Ir para Processos
          </CommandItem>
        </CommandGroup>

        {processItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Processos">
              {processItems.map((p: any) => (
                <CommandItem key={p.id} value={`processo ${p.displayName}`} onSelect={() => go('processos')}>
                  <Briefcase className="w-4 h-4 mr-2 text-primary" />
                  <span className="truncate">{p.displayName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {snapshot.tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tarefas pendentes">
              {snapshot.tasks.slice(0, 10).map((t: any) => (
                <CommandItem key={t.id} value={`tarefa ${t.titulo}`} onSelect={() => go('tasks')}>
                  <ListTodo className="w-4 h-4 mr-2 text-primary" />
                  <span className="truncate">{t.titulo}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {snapshot.clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clientes">
              {snapshot.clients.slice(0, 10).map((c: any) => (
                <CommandItem key={c.id} value={`cliente ${c.nome}`} onSelect={() => go('clients')}>
                  <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{c.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
