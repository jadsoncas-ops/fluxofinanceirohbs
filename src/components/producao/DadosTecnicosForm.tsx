import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Divide } from 'lucide-react';
import { Process, Unidade, ProprietarioGeral } from '@/lib/types';
import { updateProcess } from '@/lib/storage';
import { ATOS_REGISTRAIS_OPCOES } from '@/lib/producao/requerimento';
import { compoemMedidas } from '@/lib/producao/documentoShared';
import { distribuirIgualmente } from '@/lib/producao/fracaoIdeal';
import { Input } from '@/components/ui/input';

type CampoArea = 'areaPrivativa' | 'areaGaragem' | 'areaComum';
const CAMPO_LABEL: Record<CampoArea, string> = { areaPrivativa: 'Privativa', areaGaragem: 'Garagem', areaComum: 'Comum' };

function novaUnidade(): Unidade {
  return { id: crypto.randomUUID(), pavimento: '', nome: '', tipo: 'Apartamento', banheiros: 1, areaPrivativa: 0, areaGaragem: 0, areaComum: 0, autonoma: true };
}

/** Editor dos dados técnicos do trabalho (Process.tecnico) — unidades, terreno, matrícula, proprietários, atos registrais. Persiste direto via updateProcess a cada alteração. */
export function DadosTecnicosForm({ trabalho, onChange }: { trabalho: Process; onChange: () => void }) {
  const [aberto, setAberto] = useState(!trabalho.tecnico?.units?.length);
  const [unidadeExpandida, setUnidadeExpandida] = useState<string | null>(null);
  const [divCampo, setDivCampo] = useState<CampoArea>('areaPrivativa');
  const [divTotal, setDivTotal] = useState('');
  const tecnico = trabalho.tecnico || { units: [] };
  const proprietariosGerais = tecnico.proprietariosGerais || [];
  const atos = tecnico.atosRegistraisRequerimento || [];

  function salvar(patch: Partial<NonNullable<Process['tecnico']>>) {
    updateProcess({ ...trabalho, tecnico: { ...tecnico, ...patch } });
    onChange();
  }

  function salvarEndereco(endereco: string) {
    updateProcess({ ...trabalho, endereco });
    onChange();
  }

  function addUnidade() {
    salvar({ units: [...tecnico.units, novaUnidade()] });
  }

  function updateUnidade(id: string, patch: Partial<Unidade>) {
    salvar({ units: tecnico.units.map(u => (u.id === id ? { ...u, ...patch } : u)) });
  }

  function removeUnidade(id: string) {
    salvar({ units: tecnico.units.filter(u => u.id !== id) });
  }

  const unidadesAutonomas = tecnico.units.filter(u => u.autonoma !== false);

  function aplicarDivisaoIgual() {
    const total = parseFloat(divTotal.replace(',', '.'));
    if (!total || total <= 0 || unidadesAutonomas.length === 0) return;
    const valores = distribuirIgualmente(total, unidadesAutonomas.length);
    let i = 0;
    salvar({ units: tecnico.units.map(u => (u.autonoma === false ? u : { ...u, [divCampo]: valores[i++] })) });
    setDivTotal('');
  }

  function addProprietario() {
    salvar({ proprietariosGerais: [...proprietariosGerais, { nome: '', cpf: '' }] });
  }

  function updateProprietario(idx: number, patch: Partial<ProprietarioGeral>) {
    salvar({ proprietariosGerais: proprietariosGerais.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
  }

  function removeProprietario(idx: number) {
    salvar({ proprietariosGerais: proprietariosGerais.filter((_, i) => i !== idx) });
  }

  function toggleAto(key: string) {
    const has = atos.includes(key as never);
    salvar({ atosRegistraisRequerimento: has ? atos.filter(a => a !== key) : [...atos, key as typeof atos[number]] });
  }

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setAberto(a => !a)} className="w-full flex items-center justify-between px-[18px] py-[15px] border-b border-3 text-left">
        <div>
          <div className="text-[13.5px] font-semibold">Dados técnicos do trabalho</div>
          <div className="text-[11.5px] text-mute-2 mt-0.5">{tecnico.units.length} unidade{tecnico.units.length === 1 ? '' : 's'} cadastrada{tecnico.units.length === 1 ? '' : 's'} · usado pelos geradores de documento</div>
        </div>
        {aberto ? <ChevronUp className="w-4 h-4 text-mute-2" /> : <ChevronDown className="w-4 h-4 text-mute-2" />}
      </button>

      {aberto && (
        <div className="px-[18px] py-[15px] space-y-4">
          <Field label="Endereço do imóvel">
            <Input value={trabalho.endereco || ''} onChange={e => salvarEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade - UF" className="h-9 text-xs" />
          </Field>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <Field label="Matrícula do imóvel">
              <Input value={tecnico.matricula || ''} onChange={e => salvar({ matricula: e.target.value })} placeholder="Ex: 12.345" className="h-9 text-xs" />
            </Field>
            <Field label="ART / RRT">
              <Input value={tecnico.art || ''} onChange={e => salvar({ art: e.target.value })} placeholder="Ex: BA20260012345" className="h-9 text-xs" />
            </Field>
            <Field label="Área do terreno (m²)">
              <Input type="number" value={tecnico.terreno ?? ''} onChange={e => salvar({ terreno: parseFloat(e.target.value) || 0 })} placeholder="0,00" className="h-9 text-xs" />
            </Field>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 mb-1">Formato do terreno</div>
            <select
              value={tecnico.formatoTerreno || 'irregular'}
              onChange={e => salvar({ formatoTerreno: e.target.value as 'regular' | 'irregular' })}
              className="h-9 px-2.5 rounded-lg border-2 bg-card text-[12px] w-full max-w-[420px]"
            >
              <option value="irregular">Irregular — texto livre (linhas quebradas, ângulos, arcos)</option>
              <option value="regular">Regular — 4 lados retos, um valor cada</option>
            </select>
          </div>

          {tecnico.formatoTerreno === 'regular' ? (
            <div className="space-y-2">
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                <Field label="Frente (m)"><Input type="number" step="0.01" value={tecnico.frente ?? ''} onChange={e => salvar({ frente: parseFloat(e.target.value) || undefined })} className="h-9 text-xs" /></Field>
                <Field label="Fundo (m)"><Input type="number" step="0.01" value={tecnico.fundo ?? ''} onChange={e => salvar({ fundo: parseFloat(e.target.value) || undefined })} className="h-9 text-xs" /></Field>
                <Field label="Lado direito (m)"><Input type="number" step="0.01" value={tecnico.lateralDireita ?? ''} onChange={e => salvar({ lateralDireita: parseFloat(e.target.value) || undefined })} className="h-9 text-xs" /></Field>
                <Field label="Lado esquerdo (m)"><Input type="number" step="0.01" value={tecnico.lateralEsquerda ?? ''} onChange={e => salvar({ lateralEsquerda: parseFloat(e.target.value) || undefined })} className="h-9 text-xs" /></Field>
              </div>
              <div className="bg-surface-2 rounded-lg px-3 py-2.5 text-[11.5px] text-mute-2">
                Texto que vai pro documento: <span className="text-foreground font-medium">{compoemMedidas(tecnico.frente, tecnico.fundo, tecnico.lateralDireita, tecnico.lateralEsquerda) || '—'}</span>
              </div>
            </div>
          ) : (
            <Field label="Medidas do terreno (texto para o documento)">
              <Input value={tecnico.medidas || ''} onChange={e => salvar({ medidas: e.target.value })} placeholder="Ex: 23,79m de frente; 5,90m + 12,04m de fundo..." className="h-9 text-xs" />
            </Field>
          )}

          <Field label="Áreas comuns (itens específicos, opcional — some ao texto padrão)">
            <Input value={tecnico.areasComuns || ''} onChange={e => salvar({ areasComuns: e.target.value })} placeholder="Ex: playground, salão de festas, piscina" className="h-9 text-xs" />
          </Field>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[12.5px] cursor-pointer w-fit">
              <input type="checkbox" checked={!!tecnico.semFracao} onChange={e => salvar({ semFracao: e.target.checked })} className="w-3.5 h-3.5 accent-primary" />
              Sem fração ideal (documento cita só área total, sem % de condomínio)
            </label>
            <label className="flex items-center gap-2 text-[12.5px] cursor-pointer w-fit">
              <input type="checkbox" checked={!!tecnico.condominioDuasUnidades} onChange={e => salvar({ condominioDuasUnidades: e.target.checked })} className="w-3.5 h-3.5 accent-primary" />
              Condomínio com 2 unidades (regras específicas na Convenção)
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-[.07em] text-mute-2">Proprietários (quando há mais de um)</span>
              <button onClick={addProprietario} className="h-7 px-2.5 rounded-lg border-2 text-[11.5px] font-medium hover:border-hover transition-colors flex items-center gap-1">
                <Plus className="w-3 h-3" /> Proprietário
              </button>
            </div>
            {proprietariosGerais.length === 0 ? (
              <div className="text-xs text-muted-foreground py-1.5">Nenhum adicionado — os documentos usam o cliente do trabalho como único proprietário.</div>
            ) : (
              <div className="space-y-1.5">
                {proprietariosGerais.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={p.nome} onChange={e => updateProprietario(i, { nome: e.target.value })} placeholder="Nome completo" className="h-8 text-xs flex-[1.5]" />
                    <Input value={p.cpf} onChange={e => updateProprietario(i, { cpf: e.target.value })} placeholder="CPF/CNPJ" className="h-8 text-xs flex-1" />
                    <button onClick={() => removeProprietario(i)} className="h-8 w-8 flex-none grid place-items-center rounded-lg border-2 text-destructive hover:border-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-[.07em] text-mute-2 block mb-2">Atos registrais a requerer (usado pelo Requerimento)</span>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {ATOS_REGISTRAIS_OPCOES.map(o => (
                <label key={o.key} className="flex items-center gap-2 text-[12px] cursor-pointer">
                  <input type="checkbox" checked={atos.includes(o.key as never)} onChange={() => toggleAto(o.key)} className="w-3.5 h-3.5 accent-primary flex-none" />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-[.07em] text-mute-2">Unidades</span>
              <button onClick={addUnidade} className="h-7 px-2.5 rounded-lg border-2 text-[11.5px] font-medium hover:border-hover transition-colors flex items-center gap-1">
                <Plus className="w-3 h-3" /> Unidade
              </button>
            </div>

            {unidadesAutonomas.length >= 2 && (
              <div className="flex flex-wrap items-end gap-2 bg-surface-2 border border-3 rounded-lg p-2.5 mb-2.5">
                <MiniField label="Dividir área total entre as unidades">
                  <select value={divCampo} onChange={e => setDivCampo(e.target.value as CampoArea)} className="h-8 px-2 rounded-lg border-2 bg-card text-xs">
                    {(Object.keys(CAMPO_LABEL) as CampoArea[]).map(c => <option key={c} value={c}>{CAMPO_LABEL[c]}</option>)}
                  </select>
                </MiniField>
                <MiniField label="Total (m²)">
                  <Input type="number" value={divTotal} onChange={e => setDivTotal(e.target.value)} placeholder="0,0000" className="h-8 text-xs w-[110px]" />
                </MiniField>
                <button onClick={aplicarDivisaoIgual} className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-medium flex items-center gap-1.5">
                  <Divide className="w-3 h-3" /> Dividir entre {unidadesAutonomas.length} unidades
                </button>
                <span className="text-[10.5px] text-mute-2 basis-full">A soma sempre fecha exata com o total — sem precisar ajustar 0,0001 na mão.</span>
              </div>
            )}

            {tecnico.units.length === 0 ? (
              <div className="text-xs text-muted-foreground py-3">Nenhuma unidade ainda — adicione ao menos uma para gerar os documentos.</div>
            ) : (
              <div className="space-y-2">
                {tecnico.units.map(u => (
                  <div key={u.id} className="border border-3 rounded-lg p-2.5 space-y-2">
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))' }}>
                      <MiniField label="Pavimento"><Input value={u.pavimento} onChange={e => updateUnidade(u.id, { pavimento: e.target.value })} placeholder="Térreo" className="h-8 text-xs" /></MiniField>
                      <MiniField label="Nome/Unid."><Input value={u.nome} onChange={e => updateUnidade(u.id, { nome: e.target.value })} placeholder="Apto 101" className="h-8 text-xs" /></MiniField>
                      <MiniField label="Banheiros"><Input type="number" value={u.banheiros} onChange={e => updateUnidade(u.id, { banheiros: parseInt(e.target.value) || 0 })} className="h-8 text-xs" /></MiniField>
                      <MiniField label="Privativa m²"><Input type="number" value={u.areaPrivativa} onChange={e => updateUnidade(u.id, { areaPrivativa: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" /></MiniField>
                      <MiniField label="Garagem m²"><Input type="number" value={u.areaGaragem} onChange={e => updateUnidade(u.id, { areaGaragem: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" /></MiniField>
                      <MiniField label="Comum m²"><Input type="number" value={u.areaComum} onChange={e => updateUnidade(u.id, { areaComum: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" /></MiniField>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input value={u.comodos || ''} onChange={e => updateUnidade(u.id, { comodos: e.target.value })} placeholder="Cômodos (ex: sala, 2 quartos, cozinha, banheiro)" className="h-8 text-xs flex-1" />
                      <label className="flex items-center gap-1.5 text-[11px] text-mute-2 whitespace-nowrap">
                        <input type="checkbox" checked={u.autonoma !== false} onChange={e => updateUnidade(u.id, { autonoma: e.target.checked })} className="w-3 h-3 accent-primary" /> Autônoma
                      </label>
                      <button onClick={() => setUnidadeExpandida(id => (id === u.id ? null : u.id))} className="h-8 px-2 rounded-lg border-2 text-[10.5px] font-medium hover:border-hover transition-colors whitespace-nowrap">
                        {unidadeExpandida === u.id ? 'Menos campos' : 'Mais campos'}
                      </button>
                      <button onClick={() => removeUnidade(u.id)} className="h-8 w-8 flex-none grid place-items-center rounded-lg border-2 text-destructive hover:border-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {unidadeExpandida === u.id && (
                      <div className="grid gap-2 pt-2 border-t border-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <MiniField label="Inscrição municipal"><Input value={u.inscricao || ''} onChange={e => updateUnidade(u.id, { inscricao: e.target.value })} className="h-8 text-xs" /></MiniField>
                        <MiniField label="Matrícula individual"><Input value={u.matriculaIndividual || ''} onChange={e => updateUnidade(u.id, { matriculaIndividual: e.target.value })} className="h-8 text-xs" /></MiniField>
                        <MiniField label="Origem de aquisição"><Input value={u.origemAquisicao || ''} onChange={e => updateUnidade(u.id, { origemAquisicao: e.target.value })} placeholder="Ex: por compra e venda" className="h-8 text-xs" /></MiniField>
                        <MiniField label="CPF do proprietário desta unidade"><Input value={u.proprietarioCpf || ''} onChange={e => updateUnidade(u.id, { proprietarioCpf: e.target.value })} placeholder="Quando há mais de 1 dono" className="h-8 text-xs" /></MiniField>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 mb-1">{label}</div>
      {children}
    </div>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[.05em] text-mute-3 mb-0.5">{label}</div>
      {children}
    </div>
  );
}
