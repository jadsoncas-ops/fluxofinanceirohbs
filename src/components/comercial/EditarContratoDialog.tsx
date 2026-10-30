import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Client, Contrato, ContratoParcela, EstadoCivil, RequerenteAdicional } from '@/lib/types';
import { getClients, getProcesses, getTransactions, updateContrato, updateProcess, updateTransaction, registrarEvento } from '@/lib/storage';
import { precisaQualificarConjuge } from '@/lib/producao/documentoShared';
import { formatBRL } from '@/lib/comercial/precificacao';

const ESTADOS_CIVIS: EstadoCivil[] = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];

/** Foto da qualificação de um cliente cadastrado, para entrar como contratante adicional. */
function contratanteDoCliente(c: Client): RequerenteAdicional {
  const e = c.endereco;
  return {
    nome: c.nome,
    documento: c.documento || undefined,
    estadoCivil: c.qualificacao?.estadoCivil,
    profissao: c.qualificacao?.profissao,
    conjugeNome: c.qualificacao?.conjuge?.nome,
    endereco: e ? [e.rua, e.numero, e.bairro, e.cidade, e.estado].filter(Boolean).join(', ') || undefined : undefined,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  contrato: Contrato | null;
}

/** Edita o valor/parcelas de um contrato já gerado. Diferente da Proposta (que só tem preço
 *  sugerido antes de aprovar), o Contrato é o número "oficial" — se tem parcelas com lançamento
 *  já criado (contrato.parcelas[].transactionId), edita o lançamento junto, senão o Fluxo de Caixa
 *  ficaria mostrando um valor diferente do contrato. Se o trabalho já nasceu daqui, atualiza
 *  também o valorContrato do Trabalho, que é o número usado nos cálculos de lucro. */
export function EditarContratoDialog({ open, onClose, onSaved, contrato }: Props) {
  const [valorSemParcelas, setValorSemParcelas] = useState(0);
  const [parcelas, setParcelas] = useState<ContratoParcela[]>([]);
  const [adicionais, setAdicionais] = useState<RequerenteAdicional[]>([]);
  const [clienteParaAdicionar, setClienteParaAdicionar] = useState('');

  useEffect(() => {
    if (!open || !contrato) return;
    setValorSemParcelas(contrato.valor);
    setParcelas(contrato.parcelas.map(p => ({ ...p })));
    setAdicionais((contrato.contratantesAdicionais || []).map(a => ({ ...a })));
    setClienteParaAdicionar('');
  }, [open, contrato]);

  if (!contrato) return null;

  const temParcelas = contrato.parcelas.length > 0;
  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);

  function updateParcela(i: number, patch: Partial<ContratoParcela>) {
    setParcelas(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  const clientes = getClients();
  const principal = clientes.find(c => c.id === contrato.clienteId);
  const jaNoContrato = new Set([contrato.clienteId, ...adicionais.map(a => clientes.find(c => c.nome === a.nome && (c.documento || undefined) === a.documento)?.id).filter(Boolean) as string[]]);
  const clientesDisponiveis = clientes.filter(c => !jaNoContrato.has(c.id));

  function updateAdicional(i: number, patch: Partial<RequerenteAdicional>) {
    setAdicionais(prev => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function adicionarClienteCadastrado(id: string) {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    setAdicionais(prev => [...prev, contratanteDoCliente(c)]);
    setClienteParaAdicionar('');
  }

  function handleSave() {
    // Linha sem nome é só rascunho esquecido; quem entra no contrato precisa de CPF/CNPJ.
    const finais = adicionais.filter(a => a.nome.trim());
    const semDocumento = finais.find(a => !a.documento?.trim());
    if (semDocumento) { toast.error(`Informe o CPF/CNPJ de ${semDocumento.nome.trim()}.`); return; }
    const contratantesMudaram = JSON.stringify(finais) !== JSON.stringify(contrato.contratantesAdicionais || []);
    // Sem contratantes adicionais (e sem ter tido antes) fica undefined: o contrato grava como sempre gravou.
    const contratantesAdicionais = finais.length > 0 ? finais : (contrato.contratantesAdicionais?.length ? [] : undefined);

    const novoValor = temParcelas ? totalParcelas : valorSemParcelas;
    if (novoValor <= 0) { toast.error('O valor do contrato precisa ser maior que zero.'); return; }

    if (temParcelas) {
      const transacoes = getTransactions();
      parcelas.forEach(p => {
        if (!p.transactionId) return;
        const tx = transacoes.find(t => t.id === p.transactionId);
        if (!tx) return;
        updateTransaction({ ...tx, valor: p.valor, data: p.vencimento || tx.data, descricao: p.descricao, updatedAt: Date.now() });
      });
    }

    updateContrato({ ...contrato, valor: novoValor, parcelas, contratantesAdicionais, updatedAt: Date.now() });

    if (contrato.trabalhoId) {
      const trabalho = getProcesses().find(p => p.id === contrato.trabalhoId);
      if (trabalho) updateProcess({ ...trabalho, valorContrato: novoValor, updatedAt: Date.now() });
    }

    registrarEvento({
      modulo: 'Comercial',
      texto: `Contrato ${contrato.codigo} editado — novo valor ${formatBRL(novoValor)}${contratantesMudaram ? ` · ${finais.length ? `${finais.length + 1} contratantes` : 'contratante único'}` : ''}`,
      clienteId: contrato.clienteId,
      contratoId: contrato.id,
      trabalhoId: contrato.trabalhoId || undefined,
    });

    toast.success('Contrato atualizado.');
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar contrato {contrato.codigo}</DialogTitle></DialogHeader>

        {!temParcelas ? (
          <div className="space-y-1.5">
            <Label>Valor do contrato</Label>
            <Input type="number" value={valorSemParcelas || ''} onChange={e => setValorSemParcelas(Number(e.target.value) || 0)} />
            <p className="text-[11px] text-muted-foreground">Este contrato ainda não tem trabalho/parcelas — é só esse número que muda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground -mt-1">
              Cada parcela já tem um lançamento no Fluxo de Caixa — editar aqui atualiza o lançamento junto, pra não ficar número diferente entre as telas.
            </div>
            {parcelas.map((p, i) => (
              <div key={p.id} className="flex gap-2 items-center">
                <Input value={p.descricao} onChange={e => updateParcela(i, { descricao: e.target.value })} placeholder="Descrição" className="flex-1 h-8 text-xs" />
                <Input type="number" value={p.valor || ''} onChange={e => updateParcela(i, { valor: Number(e.target.value) || 0 })} placeholder="Valor" className="w-24 h-8 text-xs" />
                <Input type="date" value={p.vencimento || ''} onChange={e => updateParcela(i, { vencimento: e.target.value })} className="w-36 h-8 text-xs" />
              </div>
            ))}
            <div className="text-xs font-mono-hbs text-muted-foreground pt-1">Total: {formatBRL(totalParcelas)}</div>
          </div>
        )}

        <div className="space-y-2.5 pt-3 border-t border-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Label>Outros contratantes</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Mais de uma pessoa assina este contrato? Todas entram no texto e respondem solidariamente. Cobrança e financeiro continuam em {principal?.nome || 'o cliente principal'}.</p>
            </div>
            <button type="button" onClick={() => setAdicionais(prev => [...prev, { nome: '' }])} className="text-[11.5px] font-medium text-accent flex items-center gap-1 flex-none">
              <Plus className="w-3.5 h-3.5" /> Pessoa
            </button>
          </div>

          {clientesDisponiveis.length > 0 && (
            <Select value={clienteParaAdicionar} onValueChange={adicionarClienteCadastrado}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Adicionar um cliente já cadastrado…" /></SelectTrigger>
              <SelectContent>{clientesDisponiveis.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          )}

          {adicionais.map((a, i) => (
            <div key={i} className="rounded-lg border border-3 bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Contratante {i + 2}</div>
                <button type="button" onClick={() => setAdicionais(prev => prev.filter((_, idx) => idx !== i))} className="text-mute-3 hover:text-destructive transition-colors" title="Remover">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <Input value={a.nome} onChange={e => updateAdicional(i, { nome: e.target.value })} placeholder="Nome completo" className="h-8 text-xs" />
                <Input value={a.documento || ''} onChange={e => updateAdicional(i, { documento: e.target.value })} placeholder="CPF/CNPJ" className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={a.estadoCivil || ''} onValueChange={v => updateAdicional(i, { estadoCivil: v as EstadoCivil })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Estado civil" /></SelectTrigger>
                  <SelectContent>{ESTADOS_CIVIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={a.profissao || ''} onChange={e => updateAdicional(i, { profissao: e.target.value })} placeholder="Profissão" className="h-8 text-xs" />
              </div>
              {precisaQualificarConjuge(a.estadoCivil) && (
                <Input value={a.conjugeNome || ''} onChange={e => updateAdicional(i, { conjugeNome: e.target.value })} placeholder="Nome do cônjuge" className="h-8 text-xs" />
              )}
              <Input value={a.endereco || ''} onChange={e => updateAdicional(i, { endereco: e.target.value })} placeholder="Endereço completo" className="h-8 text-xs" />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
