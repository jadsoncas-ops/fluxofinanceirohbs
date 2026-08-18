import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { getClients, addProposta, getNextPropostaCodigo, getPrecificacaoConfig } from '@/lib/storage';
import {
  ETAPAS_PADRAO, TEMPOS_PADRAO_INICIAIS, GRUPOS,
  calcularCustoOperacionalTotal, calcularHorasProdutivas, calcularCustoHora,
  calcularCustoEtapa, calcularTotalProtocolos, calcularPrecoFinal, formatBRL,
  EtapaServico,
} from '@/lib/comercial/precificacao';
import { Proposta } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clienteIdInicial?: string;
}

export function NovaPropostaDialog({ open, onClose, onSaved, clienteIdInicial }: Props) {
  const clients = useMemo(() => getClients(), [open]);
  const config = useMemo(() => getPrecificacaoConfig(), [open]);

  const [clienteId, setClienteId] = useState(clienteIdInicial || '');
  const [titulo, setTitulo] = useState('');
  const [etapas, setEtapas] = useState<EtapaServico[]>(() =>
    ETAPAS_PADRAO.map(e => ({ ...e, ativa: false, visitas: TEMPOS_PADRAO_INICIAIS[e.id]?.v || 0, horas: TEMPOS_PADRAO_INICIAIS[e.id]?.h || 0 }))
  );
  const [protocolos, setProtocolos] = useState({ art: false, assinatura: false });
  const [lucroPercent, setLucroPercent] = useState(config.lucroPercentPadrao);
  const [impostosPercent, setImpostosPercent] = useState(config.impostosPercentPadrao);
  const [comissaoPercent, setComissaoPercent] = useState(config.comissaoPercentPadrao);
  const [prazoDias, setPrazoDias] = useState(15);

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

  function toggleEtapa(id: string) {
    setEtapas(prev => prev.map(e => (e.id === id ? { ...e, ativa: !e.ativa } : e)));
  }

  function updateEtapa(id: string, field: 'visitas' | 'horas', value: number) {
    setEtapas(prev => prev.map(e => (e.id === id ? { ...e, [field]: value } : e)));
  }

  function handleSave() {
    if (!clienteId) {
      toast.error('Selecione o cliente.');
      return;
    }
    if (!titulo.trim()) {
      toast.error('Dê um título à proposta.');
      return;
    }
    const ativos = etapas.filter(e => e.ativa);
    if (ativos.length === 0) {
      toast.error('Selecione ao menos um serviço.');
      return;
    }

    const proposta: Proposta = {
      id: crypto.randomUUID(),
      codigo: getNextPropostaCodigo(),
      clienteId,
      trabalhoId: null,
      titulo: titulo.trim(),
      itens: ativos.map(e => ({ etapaId: e.id, nome: e.nome, grupo: e.grupo, visitas: e.visitas, horas: e.horas })),
      custoHoraBase: custoHora,
      lucroPercent, impostosPercent, comissaoPercent,
      custosProtocolo: protocolos,
      resultado: {
        custoTecnico, custoProtocolos, custoTotal: resultado.custoTotal,
        lucro: resultado.lucro, imposto: resultado.imposto, comissao: resultado.comissao,
        precoVenda: resultado.precoVenda, margem: resultado.margem,
      },
      prazoDias,
      status: 'Rascunho',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addProposta(proposta);
    toast.success(`Proposta ${proposta.codigo} criada.`);
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova proposta</DialogTitle></DialogHeader>

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

          <div className="rounded-xl border border-border p-4 bg-surface-2 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Custo/hora atual</span><span className="font-mono-hbs">{formatBRL(custoHora)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Custo técnico</span><span className="font-mono-hbs">{formatBRL(custoTecnico)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Protocolos</span><span className="font-mono-hbs">{formatBRL(custoProtocolos)}</span></div>
            <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-3"><span>Preço sugerido</span><span className="font-mono-hbs text-success">{formatBRL(resultado.precoVenda)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar proposta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
