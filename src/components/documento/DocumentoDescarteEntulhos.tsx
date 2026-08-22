import { useState } from 'react';
import { toast } from 'sonner';
import { CompanyConfig, DescarteEntulhosData, Process } from '@/lib/types';
import { updateProcess } from '@/lib/storage';
import { dadosIniciaisDescarteEntulhos, montarDescarteEntulhos } from '@/lib/producao/descarteEntulhos';
import { CampoEdicao, campoInputCls } from './CampoEdicao';
import logoJadsonCastro from '@/assets/logo-jadson-castro.png';

export function DocumentoDescarteEntulhos({ trabalho, config, onSaved }: { trabalho: Process; config: CompanyConfig; onSaved?: () => void }) {
  const [data, setData] = useState<DescarteEntulhosData>(() => dadosIniciaisDescarteEntulhos(trabalho));
  const dados = montarDescarteEntulhos(data, config);

  function set<K extends keyof DescarteEntulhosData>(key: K, value: DescarteEntulhosData[K]) {
    setData(d => ({ ...d, [key]: value }));
  }

  function salvar() {
    updateProcess({ ...trabalho, descarteEntulhos: data });
    toast.success('Dados da declaração de descarte salvos no trabalho.');
    onSaved?.();
  }

  return (
    <div className="documento-folha">
      <div className="no-print" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--doc-line)', borderRadius: 10, padding: 16, background: '#fafafa' }}>
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
          <h1>Declaração de destinação de resíduos da demolição</h1>
          <div className="sub">Manejo e destinação de resíduos da construção civil</div>
        </div>
        <div className="kicker">{dados.data}</div>
      </div>

      <p className="documento-p">
        Declaro, para os devidos fins, que todo o material proveniente da demolição será coletado, transportado e destinado
        de forma adequada por empresa especializada em remoção de entulhos, regularmente licenciada para o manejo de
        resíduos da construção civil.
      </p>
      <p className="documento-p">
        A coleta e o transporte serão realizados conforme as normas ambientais e municipais vigentes, garantindo que nenhum
        resíduo será descartado em vias públicas, terrenos baldios ou locais não autorizados, sendo encaminhado
        exclusivamente para área licenciada.
      </p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '2rem' }}>{dados.cidade}, {dados.data}.</p>
        <div className="documento-sign-grid">
          <div>
            <div className="linha">{dados.responsavelNome}</div>
            <div className="papel">Responsável Técnico — Engenheiro Civil{dados.responsavelCrea ? ` — ${dados.responsavelCrea}` : ''}</div>
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
