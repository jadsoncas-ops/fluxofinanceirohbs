import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FileStack } from 'lucide-react';
import { getDocuments, getClients, getProcesses } from '@/lib/storage';
import { DocumentRecord, DocumentSituacao, TipoDocumentoTecnico } from '@/lib/types';
import { cn } from '@/lib/utils';

type Aba = 'Em produção' | 'Recentes' | 'Concluídos' | 'Modelos';
const ABAS: Aba[] = ['Em produção', 'Recentes', 'Concluídos', 'Modelos'];

const badgeStyle: Record<DocumentSituacao, string> = {
  Vigente: 'bg-success-soft text-success',
  Pendente: 'bg-warning-soft text-warning',
  Entregue: 'bg-accent-soft text-accent',
  Modelo: 'bg-neutral-soft text-mute-2',
  'Em produção': 'bg-warning-soft text-warning',
  'Em revisão': 'bg-warning-soft text-warning',
  Rascunho: 'bg-neutral-soft text-mute-2',
  Desatualizado: 'bg-destructive-soft text-destructive',
  Concluído: 'bg-success-soft text-success',
};

interface Ferramenta {
  grupo: string;
  nome: string;
  frase: string;
  tempo: string;
  tipo: TipoDocumentoTecnico;
}

const FERRAMENTAS: Ferramenta[] = [
  { grupo: 'Condomínio', nome: 'Instituição de Condomínio', frase: 'Monte a documentação completa de instituição a partir dos dados do empreendimento.', tempo: '~8 min', tipo: 'instituicao' },
  { grupo: 'Condomínio', nome: 'Convenção de Condomínio', frase: 'Gere a convenção com as frações ideais e regras já preenchidas.', tempo: '~10 min', tipo: 'convencao' },
  { grupo: 'Condomínio', nome: 'Instituição Simplificada', frase: 'Versão reduzida para empreendimentos de até quatro unidades.', tempo: '~4 min', tipo: 'instituicao_simplificada' },
  { grupo: 'Cálculo', nome: 'Quadro NBR 12721', frase: 'Calcule e gere os quadros da norma conforme as áreas do empreendimento.', tempo: '~6 min', tipo: 'abnt' },
  { grupo: 'Descritivo', nome: 'Memorial Descritivo', frase: 'Descreva o imóvel, materiais e acabamentos a partir do modelo da HBS.', tempo: '~7 min', tipo: 'memorial' },
  { grupo: 'Laudo', nome: 'Laudo de Habitabilidade', frase: 'Ateste as condições de habitabilidade com base na vistoria registrada.', tempo: '~5 min', tipo: 'laudo' },
  { grupo: 'Protocolo', nome: 'Requerimento', frase: 'Prepare o requerimento para protocolo no portal da Prefeitura.', tempo: '~3 min', tipo: 'requerimento' },
];

function extOf(nome: string) {
  const m = nome.match(/\.([a-zA-Z0-9]{2,4})$/);
  return (m ? m[1] : 'DOC').toUpperCase();
}

export default function ProducaoPage() {
  const [aba, setAba] = useState<Aba>('Em produção');
  const navigate = useNavigate();

  const { documentos, clients, processes } = useMemo(() => {
    return { documentos: getDocuments(), clients: getClients(), processes: getProcesses() };
  }, []);

  const vinculoNome = (d: DocumentRecord) => {
    if (d.processId) {
      const p = processes.find(p => p.id === d.processId);
      if (p) return `${p.objeto || 'Trabalho'}`;
    }
    if (d.clienteId) return clients.find(c => c.id === d.clienteId)?.nome || 'Cliente';
    return 'Modelos';
  };

  const filtrados = documentos.filter(d => {
    if (aba === 'Modelos') return d.situacao === 'Modelo';
    if (aba === 'Concluídos') return d.situacao === 'Concluído' || d.situacao === 'Entregue' || d.situacao === 'Vigente';
    if (aba === 'Recentes') return true;
    return d.situacao === 'Em produção' || d.situacao === 'Em revisão' || d.situacao === 'Pendente' || d.situacao === 'Rascunho';
  });

  const contagem = (a: Aba) => documentos.filter(d => {
    if (a === 'Modelos') return d.situacao === 'Modelo';
    if (a === 'Concluídos') return d.situacao === 'Concluído' || d.situacao === 'Entregue' || d.situacao === 'Vigente';
    if (a === 'Recentes') return true;
    return d.situacao === 'Em produção' || d.situacao === 'Em revisão' || d.situacao === 'Pendente' || d.situacao === 'Rascunho';
  }).length;

  return (
    <div className="space-y-[22px] pb-10 animate-hbs-in">
      <div>
        <h1 className="text-2xl font-semibold -tracking-[.02em]">Central de produção</h1>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-[640px]">Toda a documentação técnica da HBS é produzida aqui. Escolha uma ferramenta, informe os dados do trabalho e o documento sai pronto para revisão.</p>
      </div>

      <section>
        <div className="text-[16px] font-semibold mb-3">O que você quer produzir?</div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(268px, 1fr))' }}>
          {FERRAMENTAS.map(f => (
            <div key={f.tipo} className="bg-card border border-border rounded-[10px] p-4 flex flex-col">
              <span className="text-[10px] uppercase tracking-[.07em] text-mute-2">{f.grupo}</span>
              <div className="text-[14px] font-semibold mt-1.5">{f.nome}</div>
              <p className="text-[12px] text-muted-foreground mt-1.5 leading-[1.5] flex-1">{f.frase}</p>
              <div className="flex items-center justify-between mt-3.5">
                <span className="text-[11px] font-mono-hbs text-mute-2">{f.tempo}</span>
                <button onClick={() => navigate('/trabalhos')} className="h-[31px] px-3 rounded-lg border-2 text-[12px] font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">Criar</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex gap-1 px-3 pt-3 border-b border-border">
          {ABAS.map(a => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={cn(
                'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                aba === a ? 'text-foreground border-foreground' : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              {a} <span className="font-mono-hbs text-[11px] text-mute-3">({contagem(a)})</span>
            </button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div className="py-14 text-center">
            <FileStack className="w-8 h-8 mx-auto text-mute-3 mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium">{aba === 'Concluídos' ? 'Nenhum documento concluído ainda.' : 'Nada por aqui ainda.'}</p>
            <p className="text-xs text-muted-foreground mt-1">{aba === 'Concluídos' ? 'Quando você finalizar uma revisão, o documento aparece aqui com data e versão.' : 'Escolha uma ferramenta acima para começar.'}</p>
          </div>
        ) : (
          filtrados.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-[18px] py-3 border-t border-3 hover:bg-surface-3 transition-colors">
              <span className="w-[31px] h-[31px] flex-none rounded-[7px] bg-neutral-soft grid place-items-center text-[9.5px] font-mono-hbs text-mute-2">{extOf(d.nome)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate">{d.nome}</div>
                <div className="text-[11px] text-mute-2">{vinculoNome(d)}</div>
              </div>
              <span className="text-[11px] font-mono-hbs text-mute-2 flex-none">{new Date(d.updatedAt).toLocaleDateString('pt-BR')}</span>
              <span className={cn('flex-none text-[11px] px-2 py-[3px] rounded-[5px] font-medium', badgeStyle[d.situacao])}>{d.situacao}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
