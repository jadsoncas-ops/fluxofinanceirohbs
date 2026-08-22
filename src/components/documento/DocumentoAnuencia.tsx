import { useState } from 'react';
import { toast } from 'sonner';
import { AnuenciaData, Client, Process } from '@/lib/types';
import { updateProcess } from '@/lib/storage';
import { dadosIniciaisAnuencia, montarAnuencia } from '@/lib/producao/anuencia';
import { CampoEdicao, campoInputCls } from './CampoEdicao';
import logoJadsonCastro from '@/assets/logo-jadson-castro.png';

export function DocumentoAnuencia({ trabalho, cliente, onSaved }: { trabalho: Process; cliente: Client | undefined; onSaved?: () => void }) {
  const [data, setData] = useState<AnuenciaData>(() => dadosIniciaisAnuencia(trabalho, cliente));
  const dados = montarAnuencia(data);

  function set<K extends keyof AnuenciaData>(key: K, value: AnuenciaData[K]) {
    setData(d => ({ ...d, [key]: value }));
  }

  function salvar() {
    updateProcess({ ...trabalho, anuencia: data });
    toast.success('Dados da declaração de anuência salvos no trabalho.');
    onSaved?.();
  }

  return (
    <div className="documento-folha">
      <div className="no-print" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--doc-line)', borderRadius: 10, padding: 16, background: '#fafafa' }}>
        <div className="text-[12.5px] font-semibold">Confrontante (quem declara anuência)</div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <CampoEdicao label="Nome completo"><input className={campoInputCls} value={data.declaranteNome || ''} onChange={e => set('declaranteNome', e.target.value)} /></CampoEdicao>
          <CampoEdicao label="CPF"><input className={campoInputCls} value={data.declaranteCpf || ''} onChange={e => set('declaranteCpf', e.target.value)} /></CampoEdicao>
        </div>

        <div className="text-[12.5px] font-semibold mt-1">Imóvel demarcado (proprietário)</div>
        <CampoEdicao label="Nome do proprietário / empresa"><input className={campoInputCls} value={data.proprietarioNome || ''} onChange={e => set('proprietarioNome', e.target.value)} /></CampoEdicao>
        <CampoEdicao label="Endereço do imóvel"><input className={campoInputCls} value={data.imovelEndereco || ''} onChange={e => set('imovelEndereco', e.target.value)} /></CampoEdicao>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <CampoEdicao label="Matrícula"><input className={campoInputCls} value={data.matricula || ''} onChange={e => set('matricula', e.target.value)} /></CampoEdicao>
          <CampoEdicao label="Cartório"><input className={campoInputCls} value={data.cartorio || ''} onChange={e => set('cartorio', e.target.value)} placeholder="Cartório de Registro de Imóveis" /></CampoEdicao>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <CampoEdicao label="Comarca"><input className={campoInputCls} value={data.comarca || ''} onChange={e => set('comarca', e.target.value)} /></CampoEdicao>
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
          <h1>Declaração de anuência</h1>
          <div className="sub">Demarcação de área — confrontante</div>
        </div>
        <div className="kicker">{dados.data}</div>
      </div>

      <p className="documento-p">
        Eu, {dados.declaranteNome}, inscrito(a) no CPF sob nº {dados.declaranteCpf}, na qualidade de confrontante, declaro que
        estou ciente e anuo à demarcação da área do imóvel de propriedade de {dados.proprietarioNome}, situado à{' '}
        {dados.imovelEndereco}, objeto da matrícula nº {dados.matricula} do {dados.cartorio} da Comarca de {dados.comarca}.
      </p>
      <p className="documento-p">
        Declaro, ainda, que não existe invasão, sobreposição, litígio ou qualquer oposição quanto aos limites confrontantes
        apresentados.
      </p>
      <p className="documento-p">Por ser expressão da verdade, firmo a presente.</p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '2rem' }}>{dados.cidade}, {dados.data}.</p>
        <div className="documento-sign-grid">
          <div>
            <div className="linha">{data.declaranteNome || '(preencha o confrontante)'}</div>
            <div className="papel">CPF: {data.declaranteCpf || '(não informado)'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
