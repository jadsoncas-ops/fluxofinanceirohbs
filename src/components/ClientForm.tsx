import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Client, ClientTipo, EstadoCivil, RegimeBens } from '@/lib/types';
import { addClient, updateClient } from '@/lib/storage';
import { toast } from 'sonner';

const TIPOS: ClientTipo[] = ['Pessoa física', 'Pessoa jurídica', 'Condomínio'];
const ESTADOS_CIVIS: EstadoCivil[] = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
const REGIMES_BENS: RegimeBens[] = ['Comunhão Parcial de Bens', 'Comunhão Universal de Bens', 'Separação Total de Bens', 'Participação Final nos Aquestos'];
const ESTADOS_BR = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
  ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'],
  ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
] as const;

function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function formatDocumento(raw: string, tipo: ClientTipo): string {
  const d = raw.replace(/\D/g, '');
  if (tipo === 'Pessoa física') {
    const p = d.slice(0, 11);
    if (p.length > 9) return `${p.slice(0, 3)}.${p.slice(3, 6)}.${p.slice(6, 9)}-${p.slice(9)}`;
    if (p.length > 6) return `${p.slice(0, 3)}.${p.slice(3, 6)}.${p.slice(6)}`;
    if (p.length > 3) return `${p.slice(0, 3)}.${p.slice(3)}`;
    return p;
  }
  const p = d.slice(0, 14);
  if (p.length > 12) return `${p.slice(0, 2)}.${p.slice(2, 5)}.${p.slice(5, 8)}/${p.slice(8, 12)}-${p.slice(12)}`;
  if (p.length > 8) return `${p.slice(0, 2)}.${p.slice(2, 5)}.${p.slice(5, 8)}/${p.slice(8)}`;
  if (p.length > 5) return `${p.slice(0, 2)}.${p.slice(2, 5)}.${p.slice(5)}`;
  if (p.length > 2) return `${p.slice(0, 2)}.${p.slice(2)}`;
  return p;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (client?: Client) => void;
  editItem?: Client | null;
}

export function ClientForm({ open, onClose, onSave, editItem }: Props) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ClientTipo>('Pessoa física');
  const [documento, setDocumento] = useState('');
  const [ddd, setDdd] = useState('');
  const [numero, setNumero] = useState('');
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [rua, setRua] = useState('');
  const [numEnd, setNumEnd] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [descricao, setDescricao] = useState('');
  const [qualOpen, setQualOpen] = useState(false);
  const [nacionalidade, setNacionalidade] = useState('');
  const [estadoCivil, setEstadoCivil] = useState<EstadoCivil | ''>('');
  const [regimeBens, setRegimeBens] = useState<RegimeBens | ''>('');
  const [profissao, setProfissao] = useState('');
  const [rg, setRg] = useState('');
  const [filiacao, setFiliacao] = useState('');
  const [conjugeNome, setConjugeNome] = useState('');
  const [conjugeCpf, setConjugeCpf] = useState('');
  const [conjugeProfissao, setConjugeProfissao] = useState('');
  const [conjugeAssina, setConjugeAssina] = useState(false);

  const precisaConjuge = estadoCivil === 'Casado(a)' || estadoCivil === 'União Estável';

  useEffect(() => {
    if (editItem) {
      setNome(editItem.nome);
      setTipo(editItem.tipo || 'Pessoa física');
      setDocumento(editItem.documento || '');
      setDdd(editItem.telefone?.ddd || '');
      setNumero(editItem.telefone?.numero || '');
      setCep('');
      setRua(editItem.endereco?.rua || '');
      setNumEnd(editItem.endereco?.numero || '');
      setBairro(editItem.endereco?.bairro || '');
      setCidade(editItem.endereco?.cidade || '');
      setEstado(editItem.endereco?.estado || '');
      setDescricao(editItem.descricao || '');
      const q = editItem.qualificacao;
      setNacionalidade(q?.nacionalidade || '');
      setEstadoCivil(q?.estadoCivil || '');
      setRegimeBens(q?.regimeBens || '');
      setProfissao(q?.profissao || '');
      setRg(q?.rg || '');
      setFiliacao(q?.filiacao || '');
      setConjugeNome(q?.conjuge?.nome || '');
      setConjugeCpf(q?.conjuge?.cpf || '');
      setConjugeProfissao(q?.conjuge?.profissao || '');
      setConjugeAssina(q?.conjuge?.assina || false);
      // Pessoa física quase sempre acaba precisando desses dados pra gerar documento técnico —
      // melhor já abrir do que deixar o usuário descobrir a falta lá na frente.
      setQualOpen(!!q || (editItem.tipo || 'Pessoa física') === 'Pessoa física');
    } else {
      setNome(''); setTipo('Pessoa física'); setDocumento(''); setDdd(''); setNumero('');
      setCep(''); setRua(''); setNumEnd(''); setBairro(''); setCidade(''); setEstado('BA'); setDescricao('');
      setNacionalidade(''); setEstadoCivil(''); setRegimeBens(''); setProfissao(''); setRg(''); setFiliacao('');
      setConjugeNome(''); setConjugeCpf(''); setConjugeProfissao(''); setConjugeAssina(false); setQualOpen(true);
    }
  }, [editItem, open]);

  function handleTipoChange(novoTipo: ClientTipo) {
    setTipo(novoTipo);
    setDocumento(prev => formatDocumento(prev, novoTipo));
  }

  async function buscarCep() {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error('CEP não encontrado. Preencha o endereço manualmente.'); return; }
      setRua(data.logradouro || '');
      setBairro(data.bairro || '');
      setCidade(data.localidade || '');
      setEstado(data.uf || '');
    } catch {
      toast.error('Não deu pra buscar o CEP agora. Preencha o endereço manualmente.');
    } finally {
      setCepLoading(false);
    }
  }

  function handleSave() {
    if (!nome) {
      toast.error('Preencha pelo menos o nome do cliente.');
      return;
    }

    const clearNumber = (str: string) => str.replace(/\D/g, '');

    const temQualificacao = nacionalidade || estadoCivil || regimeBens || profissao || rg || filiacao || conjugeNome;

    const clientData: Client = {
      id: editItem ? editItem.id : crypto.randomUUID(),
      nome,
      tipo,
      documento: documento || null,
      telefone: (ddd || numero) ? { ddd: clearNumber(ddd), numero: clearNumber(numero) } : null,
      endereco: (rua || numEnd || bairro || cidade || estado) ? { rua, numero: numEnd, bairro, cidade, estado } : null,
      descricao: descricao || null,
      qualificacao: temQualificacao ? {
        nacionalidade: nacionalidade || undefined,
        estadoCivil: estadoCivil || undefined,
        regimeBens: precisaConjuge ? (regimeBens || undefined) : undefined,
        profissao: profissao || undefined,
        rg: rg || undefined,
        filiacao: filiacao || undefined,
        conjuge: precisaConjuge && conjugeNome ? {
          nome: conjugeNome,
          cpf: conjugeCpf || undefined,
          profissao: conjugeProfissao || undefined,
          assina: conjugeAssina,
        } : null,
      } : undefined,
      createdAt: editItem ? editItem.createdAt : Date.now()
    };

    if (editItem) {
      updateClient(clientData);
      toast.success('Cliente atualizado com sucesso.');
    } else {
      addClient(clientData);
      toast.success('Cliente cadastrado com sucesso.');
    }
    onSave(clientData);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
           <div className="space-y-1.5">
             <Label className="text-xs">Nome / Empresa *</Label>
             <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João Silva ou Construtora B" />
           </div>

           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1.5">
               <Label className="text-xs">Tipo</Label>
               <Select value={tipo} onValueChange={v => handleTipoChange(v as ClientTipo)}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-1.5">
               <Label className="text-xs">{tipo === 'Pessoa física' ? 'CPF' : 'CNPJ'}</Label>
               <Input value={documento} onChange={e => setDocumento(formatDocumento(e.target.value, tipo))} placeholder={tipo === 'Pessoa física' ? '000.000.000-00' : '00.000.000/0001-00'} />
             </div>
           </div>

           <div className="grid grid-cols-4 gap-3">
             <div className="col-span-1 space-y-1.5">
               <Label className="text-xs">DDD</Label>
               <Input value={ddd} onChange={e => setDdd(e.target.value)} placeholder="73" maxLength={2} />
             </div>
             <div className="col-span-3 space-y-1.5">
               <Label className="text-xs">Celular / WhatsApp</Label>
               <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="999999999" maxLength={10} />
             </div>
           </div>

           <div className="space-y-2 border border-3 p-3 rounded-lg bg-surface-2">
             <Label className="text-[11px] font-bold uppercase tracking-wider text-mute-2">Endereço (opcional)</Label>
             <div className="grid grid-cols-4 gap-2 items-start">
                <div className="col-span-2 relative">
                   <Input
                     value={cep}
                     onChange={e => setCep(formatCep(e.target.value))}
                     onBlur={buscarCep}
                     placeholder="CEP"
                     className="text-xs h-8 pr-7"
                   />
                   {cepLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-mute-2 absolute right-2 top-1/2 -translate-y-1/2" />}
                </div>
                <div className="col-span-2">
                   <Input value={numEnd} onChange={e => setNumEnd(e.target.value)} placeholder="Número" className="text-xs h-8" />
                </div>
             </div>
             <Input value={rua} onChange={e => setRua(e.target.value)} placeholder="Rua / Avenida" className="text-xs h-8" />
             <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <Input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" className="text-xs h-8" />
                </div>
                <div className="col-span-1">
                  <Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade" className="text-xs h-8" />
                </div>
                <div className="col-span-1">
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger className="text-xs h-8"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{ESTADOS_BR.map(([uf, nome]) => <SelectItem key={uf} value={uf}>{uf} — {nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
             </div>
           </div>

           <div className="border border-3 rounded-lg bg-surface-2 overflow-hidden">
             <button
               type="button"
               onClick={() => setQualOpen(o => !o)}
               className="w-full flex flex-col items-start gap-1 p-3 text-left"
             >
               <div className="w-full flex items-center justify-between">
                 <span className="text-[11px] font-bold uppercase tracking-wider text-mute-2">Qualificação jurídica (opcional)</span>
                 <span className="text-[10.5px] text-mute-2">{qualOpen ? '▲' : '▼'}</span>
               </div>
               <p className="text-[10.5px] text-mute-2 font-normal normal-case tracking-normal">Dados usados em documentos e instrumentos jurídicos — preenchidos aqui, já entram prontos na hora de gerar documentos técnicos.</p>
             </button>
             {qualOpen && (
               <div className="px-3 pb-3 space-y-2">
                 <div className="grid grid-cols-2 gap-2">
                   <Input value={nacionalidade} onChange={e => setNacionalidade(e.target.value)} placeholder="Nacionalidade" className="text-xs h-8" />
                   <Input value={profissao} onChange={e => setProfissao(e.target.value)} placeholder="Profissão" className="text-xs h-8" />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                   <Select value={estadoCivil} onValueChange={v => setEstadoCivil(v as EstadoCivil)}>
                     <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Estado civil" /></SelectTrigger>
                     <SelectContent>{ESTADOS_CIVIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                   </Select>
                   <Input value={rg} onChange={e => setRg(e.target.value)} placeholder="RG" className="text-xs h-8" />
                 </div>
                 <Input value={filiacao} onChange={e => setFiliacao(e.target.value)} placeholder="Filiação (ex: filho de Fulano e Sicrana)" className="text-xs h-8" />

                 {precisaConjuge && (
                   <div className="space-y-2 border-t border-3 pt-2 mt-1">
                     <Label className="text-[10.5px] font-semibold uppercase tracking-wider text-mute-2">Cônjuge</Label>
                     <Select value={regimeBens} onValueChange={v => setRegimeBens(v as RegimeBens)}>
                       <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Regime de bens" /></SelectTrigger>
                       <SelectContent>{REGIMES_BENS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                     </Select>
                     <div className="grid grid-cols-2 gap-2">
                       <Input value={conjugeNome} onChange={e => setConjugeNome(e.target.value)} placeholder="Nome do cônjuge" className="text-xs h-8" />
                       <Input value={conjugeCpf} onChange={e => setConjugeCpf(e.target.value)} placeholder="CPF do cônjuge" className="text-xs h-8" />
                     </div>
                     <Input value={conjugeProfissao} onChange={e => setConjugeProfissao(e.target.value)} placeholder="Profissão do cônjuge" className="text-xs h-8" />
                     <label className="flex items-center gap-1.5 text-[11px] text-mute-2 cursor-pointer">
                       <input type="checkbox" checked={conjugeAssina} onChange={e => setConjugeAssina(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                       Cônjuge também assina os documentos
                     </label>
                   </div>
                 )}
               </div>
             )}
           </div>

           <div className="space-y-1.5">
             <Label className="text-xs">Observações / Descrição</Label>
             <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Obra no Bairro Y, Contrato Z" />
           </div>

           <Button onClick={handleSave} className="w-full">
              {editItem ? 'Salvar alterações' : 'Cadastrar cliente'}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
