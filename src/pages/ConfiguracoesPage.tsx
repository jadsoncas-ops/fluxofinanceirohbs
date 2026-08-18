import { useState } from 'react';
import { useRef } from 'react';
import { Moon, Download, Upload, Shield, Trash2, Building2, Smartphone, Calculator, Plus } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getCompanyConfig, saveCompanyConfig, getPrecificacaoConfig, savePrecificacaoConfig, exportBackup, importBackup, clearAllTransactions } from '@/lib/storage';
import { calcularCustoOperacionalTotal, calcularHorasProdutivas, calcularCustoHora, formatBRL } from '@/lib/comercial/precificacao';
import { CustoItem } from '@/lib/comercial/precificacao';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 mb-1">{label}</div>
      {children}
    </div>
  );
}

function CustoList({ titulo, campo, itens, onAdd, onUpdate, onRemove }: {
  titulo: string;
  campo: 'custosDiretos' | 'custosIndiretos';
  itens: CustoItem[];
  onAdd: (campo: 'custosDiretos' | 'custosIndiretos') => void;
  onUpdate: (campo: 'custosDiretos' | 'custosIndiretos', id: string, patch: Partial<CustoItem>) => void;
  onRemove: (campo: 'custosDiretos' | 'custosIndiretos', id: string) => void;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-[.07em] text-mute-2">{titulo}</span>
        <button onClick={() => onAdd(campo)} className="h-6 px-2 rounded-md border-2 text-[10.5px] font-medium hover:border-hover transition-colors flex items-center gap-1">
          <Plus className="w-3 h-3" /> Item
        </button>
      </div>
      {itens.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1">Nenhum item.</div>
      ) : (
        <div className="space-y-1.5">
          {itens.map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <Input value={item.descricao} onChange={e => onUpdate(campo, item.id, { descricao: e.target.value })} placeholder="Descrição" className="flex-1 h-8 text-xs" />
              <Input type="number" value={item.valor || ''} onChange={e => onUpdate(campo, item.id, { valor: parseFloat(e.target.value) || 0 })} placeholder="R$" className="w-24 h-8 text-xs" />
              <button onClick={() => onRemove(campo, item.id)} className="h-8 w-8 flex-none grid place-items-center rounded-lg border-2 text-destructive hover:border-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConfiguracoesPage() {
  const shell = useShell();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [config, setConfig] = useState(() => getCompanyConfig());
  const [preco, setPreco] = useState(() => getPrecificacaoConfig());

  function toggleDark(checked: boolean) {
    setDark(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  function salvarConfig(patch: Partial<typeof config>) {
    const updated = { ...config, ...patch };
    setConfig(updated);
    saveCompanyConfig(updated);
  }

  function salvarPreco(patch: Partial<typeof preco>) {
    const updated = { ...preco, ...patch };
    setPreco(updated);
    savePrecificacaoConfig(updated);
  }

  function addCusto(campo: 'custosDiretos' | 'custosIndiretos') {
    const novo: CustoItem = { id: crypto.randomUUID(), descricao: '', valor: 0, tipo: campo === 'custosDiretos' ? 'variavel' : 'fixo' };
    salvarPreco({ [campo]: [...preco[campo], novo] } as Partial<typeof preco>);
  }

  function updateCusto(campo: 'custosDiretos' | 'custosIndiretos', id: string, patch: Partial<CustoItem>) {
    salvarPreco({ [campo]: preco[campo].map(c => (c.id === id ? { ...c, ...patch } : c)) } as Partial<typeof preco>);
  }

  function removeCusto(campo: 'custosDiretos' | 'custosIndiretos', id: string) {
    salvarPreco({ [campo]: preco[campo].filter(c => c.id !== id) } as Partial<typeof preco>);
  }

  const horasProdutivas = calcularHorasProdutivas(preco.horasDisponiveis, preco.horasNaoFaturaveis);
  const custoOperacional = calcularCustoOperacionalTotal(preco.custosDiretos, preco.custosIndiretos);
  const custoHora = calcularCustoHora(custoOperacional, horasProdutivas);

  function handleExport() {
    try {
      const data = exportBackup();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup_hbs_data.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exportado com sucesso.');
    } catch {
      toast.error('Erro ao exportar backup.');
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackup(reader.result as string);
        toast.success('Backup importado com sucesso.');
        shell.refresh();
        setConfig(getCompanyConfig());
      } catch {
        toast.error('Ficheiro inválido. Verifique o formato JSON.');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClear() {
    if (confirm('Tem certeza que deseja apagar TODOS os lançamentos? Esta ação não pode ser desfeita. Seus clientes serão mantidos.')) {
      clearAllTransactions();
      toast.success('Todos os lançamentos foram apagados.');
      shell.refresh();
    }
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in max-w-[720px]">
      <div>
        <h2 className="text-[16px] font-semibold">Configurações</h2>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Dados da empresa, aparência e backup dos seus dados</p>
      </div>

      <section className="bg-card border border-border rounded-xl p-[17px_18px]">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-accent" />
          <div className="text-[13.5px] font-semibold">Empresa e responsável técnico</div>
        </div>
        <p className="text-[11.5px] text-muted-foreground mb-3.5">Usado em propostas comerciais e em todos os documentos técnicos gerados na Produção Técnica.</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Field label="Razão social"><Input value={config.razaoSocial || ''} onChange={e => salvarConfig({ razaoSocial: e.target.value })} placeholder="HBS Engenharia" className="h-9 text-xs" /></Field>
          <Field label="CNPJ"><Input value={config.cnpj || ''} onChange={e => salvarConfig({ cnpj: e.target.value })} placeholder="00.000.000/0001-00" className="h-9 text-xs" /></Field>
          <Field label="Telefone"><Input value={config.telefone || ''} onChange={e => salvarConfig({ telefone: e.target.value })} placeholder="(73) 9 9118-9164" className="h-9 text-xs" /></Field>
          <Field label="E-mail"><Input value={config.email || ''} onChange={e => salvarConfig({ email: e.target.value })} placeholder="contato@hbs.eng.br" className="h-9 text-xs" /></Field>
          <div className="col-span-full"><Field label="Endereço"><Input value={config.endereco || ''} onChange={e => salvarConfig({ endereco: e.target.value })} placeholder="Rua, número, bairro, cidade - UF" className="h-9 text-xs" /></Field></div>
          <Field label="Responsável técnico — nome"><Input value={config.responsavelNome || ''} onChange={e => salvarConfig({ responsavelNome: e.target.value })} placeholder="Nome completo" className="h-9 text-xs" /></Field>
          <Field label="CREA/CAU"><Input value={config.responsavelCrea || ''} onChange={e => salvarConfig({ responsavelCrea: e.target.value })} placeholder="CREA-BA 000000" className="h-9 text-xs" /></Field>
          <Field label="Título profissional"><Input value={config.responsavelTitulo || ''} onChange={e => salvarConfig({ responsavelTitulo: e.target.value })} placeholder="Engenheiro Civil" className="h-9 text-xs" /></Field>
          <Field label="Validade padrão de proposta (dias)"><Input type="number" value={config.validadePropostaDias ?? ''} onChange={e => salvarConfig({ validadePropostaDias: parseInt(e.target.value) || undefined })} placeholder="15" className="h-9 text-xs" /></Field>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-[17px_18px]">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-4 h-4 text-accent" />
          <div className="text-[13.5px] font-semibold">Precificação</div>
        </div>
        <p className="text-[11.5px] text-muted-foreground mb-3.5">Custos operacionais, horas produtivas e taxas de protocolo (ART, assinatura) usados no cálculo de toda proposta comercial.</p>

        <div className="grid gap-3 mb-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Field label="Horas disponíveis / mês"><Input type="number" value={preco.horasDisponiveis} onChange={e => salvarPreco({ horasDisponiveis: parseFloat(e.target.value) || 0 })} className="h-9 text-xs" /></Field>
          <Field label="Horas não faturáveis / mês"><Input type="number" value={preco.horasNaoFaturaveis} onChange={e => salvarPreco({ horasNaoFaturaveis: parseFloat(e.target.value) || 0 })} className="h-9 text-xs" /></Field>
          <Field label="ART / RRT (R$)"><Input type="number" value={preco.custosProtocolo.art} onChange={e => salvarPreco({ custosProtocolo: { ...preco.custosProtocolo, art: parseFloat(e.target.value) || 0 } })} className="h-9 text-xs" /></Field>
          <Field label="Assinatura técnica (R$)"><Input type="number" value={preco.custosProtocolo.assinatura} onChange={e => salvarPreco({ custosProtocolo: { ...preco.custosProtocolo, assinatura: parseFloat(e.target.value) || 0 } })} className="h-9 text-xs" /></Field>
        </div>

        <div className="grid gap-3 mb-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <Field label="Lucro padrão (%)"><Input type="number" value={preco.lucroPercentPadrao} onChange={e => salvarPreco({ lucroPercentPadrao: parseFloat(e.target.value) || 0 })} className="h-9 text-xs" /></Field>
          <Field label="Impostos padrão (%)"><Input type="number" value={preco.impostosPercentPadrao} onChange={e => salvarPreco({ impostosPercentPadrao: parseFloat(e.target.value) || 0 })} className="h-9 text-xs" /></Field>
          <Field label="Comissão padrão (%)"><Input type="number" value={preco.comissaoPercentPadrao} onChange={e => salvarPreco({ comissaoPercentPadrao: parseFloat(e.target.value) || 0 })} className="h-9 text-xs" /></Field>
        </div>

        <CustoList titulo="Custos diretos (variáveis por trabalho)" campo="custosDiretos" itens={preco.custosDiretos} onAdd={addCusto} onUpdate={updateCusto} onRemove={removeCusto} />
        <CustoList titulo="Custos indiretos (fixos mensais)" campo="custosIndiretos" itens={preco.custosIndiretos} onAdd={addCusto} onUpdate={updateCusto} onRemove={removeCusto} />

        <div className="bg-surface-2 rounded-lg px-3.5 py-3 mt-3.5 flex items-center justify-between">
          <span className="text-[11.5px] text-mute-2">Custo/hora resultante ({formatBRL(custoOperacional)} ÷ {horasProdutivas}h produtivas)</span>
          <span className="font-mono-hbs text-[15px] font-semibold">{formatBRL(custoHora)}</span>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-[17px_18px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-mute-2" />
          <span className="text-[13px] font-medium">Modo escuro</span>
        </div>
        <button onClick={() => toggleDark(!dark)} className={`w-10 h-6 rounded-full transition-colors relative ${dark ? 'bg-primary' : 'bg-neutral-soft'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      </section>

      <section className="bg-card border border-border rounded-xl p-[17px_18px] space-y-3.5">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <div className="text-[13.5px] font-semibold">Segurança dos dados</div>
        </div>
        <p className="text-[11.5px] text-muted-foreground">Os seus dados são armazenados localmente no navegador. Faça backups regulares para segurança.</p>

        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <button onClick={handleExport} className="h-[52px] px-3.5 border-2 rounded-lg text-left hover:border-hover transition-colors flex items-center gap-2.5">
            <Download className="w-4 h-4 text-mute-2 flex-none" />
            <div>
              <div className="text-[12px] font-medium">Exportar backup JSON</div>
              <div className="text-[10.5px] text-mute-2">Descarregar todos os dados</div>
            </div>
          </button>
          <button onClick={() => fileRef.current?.click()} className="h-[52px] px-3.5 border-2 rounded-lg text-left hover:border-hover transition-colors flex items-center gap-2.5">
            <Upload className="w-4 h-4 text-mute-2 flex-none" />
            <div>
              <div className="text-[12px] font-medium">Importar backup JSON</div>
              <div className="text-[10.5px] text-mute-2">Restaurar dados a partir de arquivo</div>
            </div>
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>

        <div className="bg-destructive-soft border border-destructive/30 rounded-lg p-[12px_14px] text-[11px] text-destructive">
          Atenção: a importação substitui os dados atuais deste aparelho pelos dados do arquivo de backup.
        </div>

        <button onClick={handleClear} className="w-full h-[52px] px-3.5 border-2 border-destructive/30 rounded-lg text-left hover:bg-destructive-soft transition-colors flex items-center gap-2.5 text-destructive">
          <Trash2 className="w-4 h-4 flex-none" />
          <div>
            <div className="text-[12px] font-medium">Limpar lançamentos</div>
            <div className="text-[10.5px] opacity-70">Apagar transações, manter clientes</div>
          </div>
        </button>
      </section>

      <section className="bg-card border border-border rounded-xl p-[17px_18px]">
        <div className="flex items-center gap-2 mb-2">
          <Smartphone className="w-4 h-4 text-mute-2" />
          <div className="text-[13.5px] font-semibold">Informações</div>
        </div>
        <div className="text-[11.5px] text-mute-2 space-y-0.5">
          <p>Armazenamento: local (navegador)</p>
          <p>Versão: 1.1.0</p>
        </div>
      </section>
    </div>
  );
}
