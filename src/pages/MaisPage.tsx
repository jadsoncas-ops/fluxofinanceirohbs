import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ListTodo, Settings as SettingsIcon, ChevronRight, Scale } from 'lucide-react';

export default function MaisPage() {
  const navigate = useNavigate();

  const items = [
    { to: '/tarefas', label: 'Tarefas & Agenda', desc: 'Prazos, follow-ups e checklists', icon: ListTodo },
    { to: '/avaliacoes', label: 'Avaliações', desc: 'Laudos de aluguel para a Prefeitura/CIUB', icon: Scale },
    { to: '/configuracoes', label: 'Definições', desc: 'Backup, tema e dados da conta', icon: SettingsIcon },
  ];

  return (
    <div className="space-y-3 pb-10">
      <h2 className="text-lg font-black tracking-tight mb-2">Mais</h2>
      {items.map(item => (
        <Card key={item.to} onClick={() => navigate(item.to)} className="rounded-2xl border-border/50 cursor-pointer active:scale-[0.98] transition-transform">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-muted"><item.icon className="w-5 h-5 text-muted-foreground" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
