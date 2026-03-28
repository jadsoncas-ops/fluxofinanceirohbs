import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, User, Phone, MapPin, Edit } from 'lucide-react';
import { Client } from '@/lib/types';
import { getClients } from '@/lib/storage';
import { ClientForm } from './ClientForm';

export function ClientsList() {
  const [key, setKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Client | null>(null);

  const clients = useMemo(() => {
    void key;
    return getClients();
  }, [key]);

  const refresh = () => setKey(k => k + 1);

  function handleEdit(client: Client) {
    setEditItem(client);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditItem(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> CRM / Clientes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Controle e vincule seus clientes a lançamentos</p>
        </div>
        <Button size="sm" onClick={handleAdd} className="gap-1.5 font-bold shadow-sm rounded-lg hover:-translate-y-0.5 transition-transform">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card className="border-border/40 shadow-none bg-muted/20">
          <CardContent className="p-10 text-center text-muted-foreground flex flex-col items-center">
             <div className="bg-primary/5 p-4 rounded-full mb-4">
               <User className="w-10 h-10 text-primary/40" />
             </div>
             <p className="text-sm font-bold uppercase tracking-wide">Nenhum cliente cadastrado ainda</p>
             <p className="text-xs mt-1.5 mb-5 opacity-80 max-w-xs leading-relaxed">Organize sua carteira. Cadastre o primeiro cliente para criar atalhos de WhatsApp e relatórios dedicados!</p>
             <Button variant="outline" size="sm" onClick={handleAdd} className="rounded-full shadow-sm font-semibold text-primary border-primary/20 bg-primary/5">
                + Iniciar Cadastro
             </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clients.map(c => {
             const hasWhatsApp = c.telefone?.ddd && c.telefone?.numero;
             const linkWa = hasWhatsApp ? `https://wa.me/55${c.telefone.ddd}${c.telefone.numero}` : null;
             
             return (
               <Card key={c.id} className="group overflow-hidden relative transition-all duration-300 hover:shadow-md border-border/60 hover:border-primary/30">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full rounded-tr-[inherit] -z-10 group-hover:scale-110 transition-transform duration-500"></div>
                 <CardContent className="p-4 sm:p-5 flex flex-col h-full justify-between relative z-10">
                   <div>
                     <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className="font-bold text-foreground text-[15px] tracking-tight truncate">{c.nome}</h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary transition-colors bg-background/50 hover:bg-muted/50 rounded-md shadow-sm opacity-50 group-hover:opacity-100" onClick={() => handleEdit(c)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                     </div>
                     
                     {c.descricao && (
                       <p className="text-[11px] text-muted-foreground leading-relaxed mb-3 bg-muted/30 px-2 py-1.5 rounded-md border border-border/40 italic">"{c.descricao}"</p>
                     )}

                     <div className="space-y-2 mt-3 pl-0.5">
                       {hasWhatsApp && (
                         <div className="flex items-center gap-2 text-xs text-foreground/80 font-medium">
                           <div className="bg-[#25D366]/10 p-1.5 rounded-full shrink-0">
                             <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                           </div>
                           ({c.telefone.ddd}) {c.telefone.numero.replace(/(\d{5})(\d{4})/, '$1-$2')}
                         </div>
                       )}
                       {c.endereco && (c.endereco.rua || c.endereco.bairro || c.endereco.cidade) && (
                         <div className="flex items-start gap-2 text-[11px] sm:text-xs text-foreground/70 font-medium mt-1">
                           <div className="bg-blue-500/10 p-1.5 rounded-full shrink-0 mt-0.5">
                             <MapPin className="w-3.5 h-3.5 text-blue-500" /> 
                           </div>
                           <span className="leading-tight break-words pt-0.5">
                             {c.endereco.rua}{c.endereco.numero ? `, ${c.endereco.numero}` : ''}
                             {c.endereco.bairro ? ` - ${c.endereco.bairro}` : ''}
                             {c.endereco.cidade ? ` • ${c.endereco.cidade}` : ''}
                             {c.endereco.estado ? `/${c.endereco.estado}` : ''}
                           </span>
                         </div>
                       )}
                     </div>
                   </div>

                   {hasWhatsApp && (
                     <div className="mt-4 pt-3 border-t border-border/40">
                       <a href={linkWa!} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm">
                         Chamar no WhatsApp
                       </a>
                     </div>
                   )}
                 </CardContent>
               </Card>
             );
          })}
        </div>
      )}

      <ClientForm open={formOpen} onClose={() => setFormOpen(false)} onSave={refresh} editItem={editItem} />
    </div>
  );
}
