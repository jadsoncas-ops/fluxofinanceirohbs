import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getClients, addProposta, updateProposta, getNextPropostaCodigo, getPrecificacaoConfig } from '@/lib/storage';
import {
  ETAPAS_PADRAO, TEMPOS_PADRAO_INICIAIS, GRUPOS,
  calcularCustoOperacionalTotal, calcularHorasProdutivas, calcularCustoHora,
  calcularCustoEtapa, calcularTotalProtocolos, calcularPrecoFinal, formatBRL,
  EtapaServico,
} from '@/lib/comercial/precificacao';
import { Proposta, PropostaParcela } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clienteIdInicial?: string;
  editItem?: Proposta | null;
}

const NOTA_PARCEIRO_SUGERIDA =
  'O valor total desta proposta já inclui os honorários do parceiro responsável pelo despacho/trâmite junto aos órgãos competentes. Esse valor é repassado integralmente a ele, que atua de forma independente — respondemos exclusivamente pelos serviços técnicos de engenharia aqui descritos. Os pagamentos referentes a esta proposta devem ser feitos diretamente a nós.';

function etapasIniciais(editItem?: Proposta | null): EtapaServico[] {
  return ETAPAS_PADRAO.map(e => {
    const doEdit = editItem?.itens.find(i => i.etapaId === e.id);
    return { ...e, ativa: !!doEdit, visitas: doEdit?.visitas ?? (TEMPOS_PADRAO_INICIAIS[e.id]?.v || 0), horas: doEdit?.horas ?? (TEMPOS_PADRAO_INICIAIS[e.id]?.h || 0) };
  });
}

export function NovaPropostaDialog({ open, onClose, onSaved, clienteIdInicial, editItem }: Props) {
  const clients = useMemo(() => getClients(), [open]);
  const config = useMemo(() => getPrecificacaoConfig(), [open]);

  const [clienteId, setClienteId] = useState(editItem?.clienteId || clienteIdInicial || '');
  const [titulo, setTitulo] = useState(editItem?.titulo || '');
  const [etapas, setEtapas] = useState<EtapaServico[]>(() => etapasIniciais(editItem));
  const [protocolos, setProtocolos] = useState(editItem?.custosProtocolo || { art: false, assinatura: false });
  const [lucroPercent, setLucroPercent] = useState(editItem?.lucroPercent ?? config.lucroPercentPadrao);
  const [impostosPercent, setImpostosPercent] = useState(editItem?.impostosPercent ?? config.impostosPercentPadrao);
  const [comissaoPercent, setComissaoPercent] = useState(editItem?.comissaoPercent ?? config.comissaoPercentPadrao);
  const [prazoDias, setPrazoDias] = useState(editItem?.prazoDias ?? 15);
  const [parcelas, setParcelas] = useState<PropostaParcela[]>(editItem?.parcelasPagamento || []);
  const [temParceiro, setTemParceiro] = useState(!!editItem?.observacaoParceiro);
  const [observacaoParceiro, setObservacaoParceiro] = useState(editItem?.observacaoParceiro || '');

  useEffect(() => {
    if (!open) return;
    setClienteId(editItem?.clienteId || clienteIdInicial || '');
    setTitulo(editItem?.titulo || '');
    setEtapas(etapasIniciais(editItem));
    setProtocolos(editItem?.custosProtocolo || { art: false, assinatura: false });
    setLucroPercent(editItem?.lucroPercent ?? config.lucroPercentPadrao);
    setImpostosPercent(editItem?.impostosPercent ?? config.impostosPercentPadrao);
    setComissaoPercent(editItem?.comissaoPercent ?? config.comissaoPercentPadrao);
    setPrazoDias(editItem?.prazoDias ?? 15);
    setParcelas(editItem?.parcelasPagamento || []);
    setTemParceiro(!!editItem?.observacaoParceiro);
    setObservacaoParceiro(editItem?.observacaoParceiro || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editItem?.id]);

  const custoHora = useMemo(() => {
    const operacional = calcularCustoOperacionalTotal(config.custosDiretos, config.custosIndiretos);
    const horasProdutivas = calcularHorasProdutivas(config.horasDisponiveis, config.horasNaoFaturaveis);
    return calcularCustoHora(operacional, horasProdutivas);
  }, [config]);

  const custoTecnico = useMemo(() => etapas.reduce((s, e) => s + calcularCustoEtapa(e, custoHora), 0), [etapas, custoHora]);
  const custoProtocolos = useMemo(() => calcularTotalProtocolos(protocolos, config.custosProtocolo), [protocolos, config]);
  const resultado = useMemo(
    () => calcularPrecoFinal(custoTecnico, custoProtocolos, lucroPercent, impostosPercent, comissaoPercent),
    [custoTecnico, custoProtocolos, lucroPercent, impostosPercent, comissaoPercent]
  );

  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
  const diferenca = Math.round((resultado.precoVenda - totalParcelas) * 100) / 100;

  function toggleEtapa(id: string) {
    setEtapas(prev => prev.map(e => (e.id === id ? { ...e, ativa: !e.ativa } : e)));
  }

  function updateEtapa(id: string, field: 'visitas' | 'horas', value: number) {
    setEtapas(prev => prev.map(e => (e.id === id ? { ...e, [field]: value } : e)));
  }

  function addParcela() {
    const n = parcelas.length + 1;
    setParcelas(prev => [...prev, { descricao: n === 1 ? 'Entrada' : `Parcela ${n}`, valor: 0 }]);
  }

  function updateParcela(i: number, patch: Partial<PropostaParcela>) {
    setParcelas(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function removeParcela(i: number) {
    setParcelas(prev => prev.filter((_, idx) => idx !== i));
  }

  function dividirIgualmente() {
    if (parcelas.length === 0) return;
    const cada = Math.round((resultado.precoVenda / parcelas.length) * 100) / 100;
    setParcelas(prev => prev.map((p, i) => ({ ...p, valor: i === prev.length - 1 ? Math.round((resultado.precoVenda - cada * (prev.length - 1)) * 100) / 100 : cada })));
  }

  function handleSave() {
    if (!clienteId) { toast.error('Selecione o cliente.'); return; }
    if (!titulo.trim()) { toast.error('Dê um título à proposta.'); return; }
    const ativos = etapas.filter(e => e.ativa);
    if (ativos.length === 0) { toast.error('Selecione ao menos um serviço.'); return; }

    const parcelasFinal = parcelas.length > 0 ? parcelas : [{ descricao: 'Pagamento único', valor: resultado.precoVenda }];
    const totalFinal = parcelasFinal.reduce((s, p) => s + p.valor, 0);
    if (Math.abs(resultado.precoVenda - totalFinal) > 0.01) {
      toast.error(`As condições de pagamento somam ${formatBRL(totalFinal)}, mas a proposta é de ${formatBRL(resultado.precoVenda)}.`);
      return;
    }

    const itens = ativos.map(e => ({ etapaId: e.id, nome: e.nome, grupo: e.grupo, visitas: e.visitas, horas: e.horas }));
    const resultadoFinal = {
      custoTecnico, custoProtocolos, custoTotal: resultado.custoTotal,
      lucro: resultado.lucro, imposto: resultado.imposto, comissao: resultado.comissao,
      precoVenda: resultado.precoVenda, margem: resultado.margem,
    };

    const notaParceiroFinal = temParceiro ? observacaoParceiro.trim() : undefined;

    if (editItem) {
      updateProposta({
        ...editItem,
        clienteId, titulo: titulo.trim(), itens,
        custoHoraBase: custoHora, lucroPercent, impostosPercent, comissaoPercent,
        custosProtocolo: protocolos, resultado: resultadoFinal, prazoDias,
        parcelasPagamento: parcelasFinal,
        observacaoParceiro: notaParceiroFinal,
        updatedAt: Date.now(),
      });
      toast.success(`Proposta ${editItem.codigo} atualizada.`);
    } else {
      const proposta: Proposta = {
        id: crypto.randomUUID(),
        codigo: getNextPropostaCodigo(),
        clienteId,
        trabalhoId: null,
        titulo: titulo.trim(),
        itens,
        custoHoraBase: custoHora,
        lucroPercent, impostosPercent, comissaoPercent,
        custosProtocolo: protocolos,
        resultado: resultadoFinal,
        prazoDias,
        parcelasPagamento: parcelasFinal,
        observacaoParceiro: notaParceiroFinal,
        status: 'Rascunho',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addProposta(proposta);
      toast.success(`Proposta ${proposta.codigo} criada.`);
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editItem ? `Editar proposta ${editItem.codigo}` : 'Nova proposta'}</DialogTitle></DialogHeader>

        <div className="space-y-5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título da proposta</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Regularização de imóvel" />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-mute-2">Escopo</Label>
            <div className="mt-2 space-y-3">
              {GRUPOS.map(grupo => (
                <div key={grupo}>
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">{grupo}</div>
                  <div className="space-y-1.5">
                    {etapas.filter(e => e.grupo === grupo).map(e => (
                      <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg border border-3 bg-surface-2">
                        <Checkbox checked={e.ativa} onCheckedChange={() => toggleEtapa(e.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium">{e.nome}</div>
                          {e.descricao && <div className="text-[11px] text-muted-foreground">{e.descricao}</div>}
                        </div>
                        {e.ativa && (
                          <div className="flex gap-2 flex-none">
                            <Input type="number" min={0} value={e.visitas} onChange={ev => updateEtapa(e.id, 'visitas', Number(ev.target.value) || 0)} className="w-16 h-8 text-xs" title="Visitas (8h cada)" />
                            <Input type="number" min={0} value={e.horas} onChange={ev => updateEtapa(e.id, 'horas', Number(ev.target.value) || 0)} className="w-16 h-8 text-xs" title="Horas extra" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={protocolos.art} onCheckedChange={v => setProtocolos(p => ({ ...p, art: !!v }))} /> ART/RRT ({formatBRL(config.custosProtocolo.art)})</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={protocolos.assinatura} onCheckedChange={v => setProtocolos(p => ({ ...p, assinatura: !!v }))} /> Assinatura técnica ({formatBRL(config.custosProtocolo.assinatura)})</label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Margem (%)</Label><Input type="number" value={lucroPercent} onChange={e => setLucroPercent(Number(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Impostos (%)</Label><Input type="number" value={impostosPercent} onChange={e => setImpostosPercent(Number(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Comissão (%)</Label><Input type="number" value={comissaoPercent} onChange={e => setComissaoPercent(Number(e.target.value) || 0)} /></div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Prazo de execução (dias)</Label>
            <Input type="number" value={prazoDias} onChange={e => setPrazoDias(Number(e.target.value) || 0)} className="w-32" />
          </div>

          <div className="rounded-xl border border-border p-4 bg-surface-2 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Custo/hora atual</span><span className="font-mono-hbs">{formatBRL(custoHora)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Custo técnico</span><span className="font-mono-hbs">{formatBRL(custoTecnico)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Protocolos</span><span className="font-mono-hbs">{formatBRL(custoProtocolos)}</span></div>
            <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-3"><span>Preço sugerido</span><span className="font-mono-hbs text-success">{formatBRL(resultado.precoVenda)}</span></div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={temParceiro}
                onCheckedChange={v => {
                  setTemParceiro(!!v);
                  if (v && !observacaoParceiro) setObservacaoParceiro(NOTA_PARCEIRO_SUGERIDA);
                }}
              />
              Este valor inclui honorários de um parceiro (ex.: despachante)
            </label>
            {temParceiro && (
              <div className="space-y-1">
                <Textarea value={observacaoParceiro} onChange={e => setObservacaoParceiro(e.target.value)} className="text-[12.5px] min-h-[90px]" />
                <p className="text-[11px] text-muted-foreground">Aparece na proposta impressa, perto das condições de pagamento. Edite à vontade — isso aqui é só uma sugestão de texto.</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Condições de pagamento</Label>
              <div className="flex gap-2">
                {parcelas.length > 1 && <button onClick={dividirIgualmente} className="text-[11px] text-accent font-medium">Dividir igualmente</button>}
                <button onClick={addParcela} className="text-[11px] text-accent font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Parcela</button>
              </div>
            </div>
            {parcelas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma parcela definida — ao salvar, vira "Pagamento único" pelo valor total.</p>
            ) : (
              <div className="space-y-2">
                {parcelas.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input value={p.descricao} onChange={e => updateParcela(i, { descricao: e.target.value })} placeholder="Descrição" className="flex-1 h-8 text-xs" />
                    <div className="relative w-16">
                      <Input
                        type="number"
                        value={resultado.precoVenda > 0 ? Math.round((p.valor / resultado.precoVenda) * 1000) / 10 || '' : ''}
                        onChange={e => {
                          const pct = Number(e.target.value) || 0;
                          updateParcela(i, { valor: Math.round(resultado.precoVenda * (pct / 100) * 100) / 100 });
                        }}
                        placeholder="%"
                        className="h-8 text-xs pr-4"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-mute-3 pointer-events-none">%</span>
                    </div>
                    <Input type="number" value={p.valor || ''} onChange={e => updateParcela(i, { valor: Number(e.target.value) || 0 })} placeholder="Valor" className="w-28 h-8 text-xs" />
                    <button onClick={() => removeParcela(i)} className="text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <div className={`text-xs font-mono-hbs ${Math.abs(diferenca) > 0.01 ? 'text-destructive' : 'text-success'}`}>
                  Total: {formatBRL(totalParcelas)} {Math.abs(diferenca) > 0.01 && `(diferença de ${formatBRL(diferenca)})`}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{editItem ? 'Salvar alterações' : 'Salvar proposta'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
