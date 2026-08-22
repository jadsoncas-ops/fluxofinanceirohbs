import { useState } from 'react';
import { toast } from 'sonner';
import { Process, ProcuracaoData, EstadoCivil, Client } from '@/lib/types';
import { updateProcess } from '@/lib/storage';
import { dadosIniciaisProcuracao, montarProcuracao } from '@/lib/producao/procuracao';
import { CampoEdicao, campoInputCls } from './CampoEdicao';
import logoJadsonCastro from '@/assets/logo-jadson-castro.png';

const ESTADOS_CIVIS: EstadoCivil[] = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];

export function DocumentoProcuracao({ trabalho, cliente, onSaved }: { trabalho: Process; cliente: Client | undefined; onSaved?: () => void }) {
  const [data, setData] = useState<ProcuracaoData>(() => dadosIniciaisProcuracao(trabalho, cliente));
  const dados = montarProcuracao(data);

  function set<K extends keyof ProcuracaoData>(key: K, value: ProcuracaoData[K]) {
    setData(d => ({ ...d, [key]: value }));
  }

  function salvar() {
    updateProcess({ ...trabalho, procuracao: data });
    toast.success('Dados da procuração salvos no trabalho.');
    onSaved?.();
  }

  return (
    <div className="documento-folha">
      <div className="no-print" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--doc-line)', borderRadius: 10, padding: 16, background: '#fafafa' }}>
        <div className="text-[12.5px] font-semibold">Dados do outorgante (proprietário)</div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <CampoEdicao label="Nome completo"><input className={campoInputCls} value={data.outorganteNome || ''} onChange={e => set('outorganteNome', e.target.value)} /></CampoEdicao>
          <CampoEdicao label="Nacionalidade"><input className={campoInputCls} value={data.outorganteNacionalidade || ''} onChange={e => set('outorganteNacionalidade', e.target.value)} placeholder="Brasileiro(a)" /></CampoEdicao>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <CampoEdicao label="Estado civil">
            <select className={campoInputCls} value={data.outorganteEstadoCivil || ''} onChange={e => set('outorganteEstadoCivil', e.target.value as EstadoCivil)}>
              <option value="">Selecione</option>
              {ESTADOS_CIVIS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </CampoEdicao>
          <CampoEdicao label="Profissão"><input className={campoInputCls} value={data.outorganteProfissao || ''} onChange={e => set('outorganteProfissao', e.target.value)} /></CampoEdicao>
          <CampoEdicao label="RG"><input className={campoInputCls} value={data.outorganteRg || ''} onChange={e => set('outorganteRg', e.target.value)} /></CampoEdicao>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <CampoEdicao label="CPF"><input className={campoInputCls} value={data.outorganteCpf || ''} onChange={e => set('outorganteCpf', e.target.value)} /></CampoEdicao>
          <CampoEdicao label="Endereço"><input className={campoInputCls} value={data.outorganteEndereco || ''} onChange={e => set('outorganteEndereco', e.target.value)} /></CampoEdicao>
        </div>
        <CampoEdicao label="Objeto do processo (endereço ou inscrição imobiliária do imóvel)">
          <input className={campoInputCls} value={data.objetoProcesso || ''} onChange={e => set('objetoProcesso', e.target.value)} />
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
          <h1>Procuração</h1>
          <div className="sub">Representação perante a Prefeitura Municipal e demais órgãos competentes</div>
        </div>
        <div className="kicker">{dados.data}</div>
      </div>

      <div className="documento-section-title"><div className="n">1</div><div className="t">Outorgante</div></div>
      <p className="documento-p">{dados.outorganteQualificacao}</p>

      <div className="documento-section-title"><div className="n">2</div><div className="t">Outorgado</div></div>
      <p className="documento-p">{dados.outorgadoNome.toUpperCase()}, {dados.outorgadoQualificacao}, com endereço profissional à {dados.outorgadoEndereco}.</p>

      <div className="documento-section-title"><div className="n">3</div><div className="t">Poderes</div></div>
      <p className="documento-p">
        O OUTORGANTE nomeia e constitui seu bastante procurador o OUTORGADO, conferindo-lhe poderes para representá-lo junto à
        Prefeitura Municipal e demais órgãos públicos competentes, podendo: protocolar requerimentos e documentos; acompanhar
        processos administrativos; apresentar projetos e peças técnicas; solicitar informações; receber notificações; cumprir
        exigências técnicas; assinar documentos necessários ao andamento do processo administrativo referente ao imóvel
        localizado em {dados.objeto}.
      </p>
      <p className="documento-p">
        Podendo, para tanto, praticar todos os atos necessários ao fiel cumprimento deste mandato, inclusive juntar e retirar documentos.
      </p>
      <p className="documento-p"><strong>Validade:</strong> até a conclusão do referido processo administrativo.</p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '2rem' }}>{dados.cidade}, {dados.data}.</p>
        <div className="documento-sign-grid">
          <div>
            <div className="linha">{data.outorganteNome || '(preencha o outorgante)'}</div>
            <div className="papel">CPF: {data.outorganteCpf || '(não informado)'}</div>
          </div>
        </div>
      </div>

      <div className="documento-footer">
        <div>{dados.outorgadoEndereco}</div>
      </div>
    </div>
  );
}
