import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CartaReformaData, CompanyConfig, Process } from '@/lib/types';
import { updateProcess } from '@/lib/storage';
import { dadosIniciaisCartaReforma, montarCartaReforma, SERVICOS_PADRAO } from '@/lib/producao/cartaReforma';
import { CampoEdicao, campoInputCls } from './CampoEdicao';
import logoJadsonCastro from '@/assets/logo-jadson-castro.png';

export function DocumentoCartaReforma({ trabalho, config, onSaved }: { trabalho: Process; config: CompanyConfig; onSaved?: () => void }) {
  const [data, setData] = useState<CartaReformaData>(() => dadosIniciaisCartaReforma(trabalho));
  const dados = montarCartaReforma(data, config);
  const servicos = data.servicos || [];

  function set<K extends keyof CartaReformaData>(key: K, value: CartaReformaData[K]) {
    setData(d => ({ ...d, [key]: value }));
  }

  function setServico(i: number, v: string) {
    setData(d => ({ ...d, servicos: (d.servicos || []).map((s, idx) => (idx === i ? v : s)) }));
  }

  function removerServico(i: number) {
    setData(d => ({ ...d, servicos: (d.servicos || []).filter((_, idx) => idx !== i) }));
  }

  function adicionarServico() {
    setData(d => ({ ...d, servicos: [...(d.servicos || []), ''] }));
  }

  function restaurarPadrao() {
    setData(d => ({ ...d, servicos: [...SERVICOS_PADRAO] }));
  }

  function salvar() {
    updateProcess({ ...trabalho, cartaReforma: data });
    toast.success('Dados da carta de reforma salvos no trabalho.');
    onSaved?.();
  }

  return (
    <div className="documento-folha">
      <div className="no-print" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--doc-line)', borderRadius: 10, padding: 16, background: '#fafafa' }}>
        <div className="flex items-center justify-between">
          <div className="text-[12.5px] font-semibold">Serviços a executar</div>
          <button onClick={restaurarPadrao} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Restaurar lista padrão</button>
        </div>
        <div className="space-y-2">
          {servicos.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={campoInputCls} value={s} onChange={e => setServico(i, e.target.value)} placeholder="Descreva o serviço" />
              <button onClick={() => removerServico(i)} className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive transition-colors flex-none">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button onClick={adicionarServico} className="h-8 px-3 rounded-lg border border-border text-[12px] font-medium hover:border-hover transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Adicionar serviço
          </button>
        </div>
        <CampoEdicao label="Observações adicionais (opcional)">
          <textarea className={campoInputCls} style={{ height: 60, paddingTop: 8 }} value={data.observacoes || ''} onChange={e => set('observacoes', e.target.value)} />
        </CampoEdicao>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <CampoEdicao label="Cidade"><input className={campoInputCls} value={data.cidade || ''} onChange={e => set('cidade', e.target.value)} /></CampoEdicao>
          <CampoEdicao label="Data"><input type="date" className={campoInputCls} value={data.dataDocumento || ''} onChange={e => set('dataDocumento', e.target.value)} /></CampoEdicao>
        </div>
        <button onClick={salvar} className="self-start h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary-hover transition-colors">
          Salvar dados
        </button>
      </div>

      <div className="documento-header">
        <img src={logoJadsonCastro} alt="Jadson Castro — Engenheiro Civil" className="documento-logo" />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h1>Solicitação de licença para reforma simples</h1>
          <div className="sub">À Prefeitura Municipal de {dados.cidade}</div>
        </div>
        <div className="kicker">{dados.data}</div>
      </div>

      <p className="documento-p">{dados.cidade}, {dados.data}.</p>
      <p className="documento-p">Prezados,</p>
      <p className="documento-p">
        Venho por meio desta apresentar a descrição dos serviços referentes à reforma simples a ser realizada no imóvel em
        questão, para fins de análise e emissão da devida licença junto à Prefeitura Municipal de {dados.cidade}.
      </p>
      <p className="documento-p">
        A intervenção possui caráter de manutenção predial, sem alteração de área construída e sem modificação estrutural,
        compreendendo a execução dos seguintes serviços:
      </p>
      {dados.servicos.length === 0 ? (
        <p className="documento-p">(nenhum serviço informado — adicione ao menos um serviço acima)</p>
      ) : (
        <ul style={{ margin: '0 0 0.85rem 1.2rem', padding: 0, fontSize: '13.5px', lineHeight: 1.7 }}>
          {dados.servicos.map((s, i) => <li key={i}>{s};</li>)}
        </ul>
      )}
      <p className="documento-p">
        Ressaltamos que os serviços têm finalidade de conservação, adequação e melhoria das condições de uso do imóvel, não
        implicando ampliação, demolição estrutural ou alteração da configuração arquitetônica existente.
      </p>
      {dados.observacoes && <p className="documento-p">{dados.observacoes}</p>}
      <p className="documento-p">Sem mais para o momento, colocamo-nos à disposição para quaisquer esclarecimentos que se façam necessários.</p>
      <p className="documento-p">Atenciosamente,</p>

      <div className="documento-assinaturas">
        <div className="documento-sign-grid">
          <div>
            <div className="linha">{dados.responsavelNome}</div>
            <div className="papel">Engenheiro Civil{dados.responsavelCrea ? ` — ${dados.responsavelCrea}` : ''}</div>
          </div>
        </div>
      </div>

      <div className="documento-footer">
        <div>{config.endereco || 'HBS Engenharia'}</div>
        <div>{[config.telefone, config.email].filter(Boolean).join(' | ')}</div>
      </div>
    </div>
  );
}
