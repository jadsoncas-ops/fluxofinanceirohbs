import { useEffect, useState, useMemo } from 'react';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import {
  LayoutGrid, FolderKanban, Users, ListTodo, Settings as SettingsIcon, Plus, FileText,
  Receipt, ArrowUpCircle, ArrowDownCircle, UserPlus, BarChart3,
} from 'lucide-react';
import { getClients, getProcesses, getTasks } from '@/lib/storage';
import { TransactionType } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  onNewTask: () => void;
  onNewTransaction: (tipo: TransactionType) => void;
  onNewClient?: () => void;
}

function Tile({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="w-[22px] h-[22px] flex-none rounded-[5px] bg-neutral-soft grid place-items-center">
      <Icon className="w-[13px] h-[13px] text-mute-2" strokeWidth={1.75} />
    </span>
  );
}

export function CommandPalette({ open, onOpenChange, onNavigate, onNewTask, onNewTransaction, onNewClient }: Props) {
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
    return snapshot.processes.slice(0, 8).map((p: any) => {
      const c = snapshot.clients.find((c: any) => c.id === p.clienteId);
      return { ...p, displayName: `${c?.nome || '?'} — ${p.objeto || 'Serviço'}` };
    });
  }, [snapshot]);

  function go(path: string) {
    onOpenChange(false);
    onNavigate(path);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      overlayClassName="bg-[hsl(216_10%_10%_/_0.32)] backdrop-blur-[2px]"
      contentClassName="left-1/2 -translate-x-1/2 top-[12vh] w-full max-w-[580px] max-h-[68vh] rounded-[14px] border-0 shadow-palette"
      commandClassName="rounded-[14px]"
    >
      <CommandInput placeholder="Buscar clientes, projetos, documentos ou executar uma ação" className="text-[14.5px]" />
      <CommandList className="p-2">
        <CommandEmpty className="py-8 text-center">
          <div className="text-[13px] font-medium">Nada encontrado.</div>
          <div className="text-xs text-muted-foreground mt-1">Tente o nome do cliente, o número do projeto ou uma ação como "nova despesa".</div>
        </CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go('/')} className="gap-3 py-2"><Tile icon={LayoutGrid} /><span className="text-[13px]">Início</span></CommandItem>
          <CommandItem onSelect={() => go('/clientes')} className="gap-3 py-2"><Tile icon={Users} /><span className="text-[13px]">Clientes</span></CommandItem>
          <CommandItem onSelect={() => go('/trabalhos')} className="gap-3 py-2"><Tile icon={FolderKanban} /><span className="text-[13px]">Trabalhos</span></CommandItem>
          <CommandItem onSelect={() => go('/producao')} className="gap-3 py-2"><Tile icon={FileText} /><span className="text-[13px]">Produção Técnica</span></CommandItem>
          <CommandItem onSelect={() => go('/comercial')} className="gap-3 py-2"><Tile icon={Receipt} /><span className="text-[13px]">Comercial</span></CommandItem>
          <CommandItem onSelect={() => go('/caixa/visao-geral')} className="gap-3 py-2"><Tile icon={Receipt} /><span className="text-[13px]">Fluxo de Caixa</span></CommandItem>
          <CommandItem onSelect={() => go('/relatorios')} className="gap-3 py-2"><Tile icon={BarChart3} /><span className="text-[13px]">Relatórios</span></CommandItem>
          <CommandItem onSelect={() => go('/configuracoes')} className="gap-3 py-2"><Tile icon={SettingsIcon} /><span className="text-[13px]">Configurações</span></CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => { onOpenChange(false); onNewTransaction('Entrada'); }} className="gap-3 py-2">
            <Tile icon={ArrowUpCircle} /><span className="text-[13px]">Nova receita</span>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenChange(false); onNewTransaction('Saída'); }} className="gap-3 py-2">
            <Tile icon={ArrowDownCircle} /><span className="text-[13px]">Nova despesa</span>
          </CommandItem>
          {onNewClient && (
            <CommandItem onSelect={() => { onOpenChange(false); onNewClient(); }} className="gap-3 py-2">
              <Tile icon={UserPlus} /><span className="text-[13px]">Novo cliente</span>
            </CommandItem>
          )}
          <CommandItem onSelect={() => { onOpenChange(false); onNewTask(); }} className="gap-3 py-2">
            <Tile icon={Plus} /><span className="text-[13px]">Nova tarefa</span>
          </CommandItem>
        </CommandGroup>

        {processItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Trabalhos">
              {processItems.map((p: any) => (
                <CommandItem key={p.id} value={`trabalho ${p.displayName}`} onSelect={() => go('/trabalhos')} className="gap-3 py-2">
                  <Tile icon={FolderKanban} />
                  <span className="text-[13px] truncate flex-1">{p.displayName}</span>
                  <span className="text-[11px] text-mute-3 font-mono-hbs">projeto</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {snapshot.tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tarefas pendentes">
              {snapshot.tasks.slice(0, 8).map((t: any) => (
                <CommandItem key={t.id} value={`tarefa ${t.titulo}`} onSelect={() => go('/tarefas')} className="gap-3 py-2">
                  <Tile icon={ListTodo} />
                  <span className="text-[13px] truncate flex-1">{t.titulo}</span>
                  <span className="text-[11px] text-mute-3 font-mono-hbs">tarefa</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {snapshot.clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clientes">
              {snapshot.clients.slice(0, 8).map((c: any) => (
                <CommandItem key={c.id} value={`cliente ${c.nome}`} onSelect={() => go(`/clientes/${c.id}`)} className="gap-3 py-2">
                  <Tile icon={Users} />
                  <span className="text-[13px] truncate flex-1">{c.nome}</span>
                  <span className="text-[11px] text-mute-3 font-mono-hbs">cliente</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
