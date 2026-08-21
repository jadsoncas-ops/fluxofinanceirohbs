import { Process, TipoDocumentoTecnico } from '@/lib/types';

export interface RequisitoCheck {
  label: string;
  ok: boolean;
  nivel: 'bloqueante' | 'aviso';
}

export interface DocumentTemplate {
  slug: TipoDocumentoTecnico;
  label: string;
  descricao: string;
  icon: string;
  grupo: string;
  /** false = motor ainda não foi portado — a ferramenta aparece marcada "em desenvolvimento", sem simular geração. */
  disponivel: boolean;
  requisitos: (trabalho: Process) => RequisitoCheck[];
}

function unidadeTemAreaValida(u: { areaPrivativa: number; areaGaragem: number; areaComum: number }) {
  return Number.isFinite(u.areaPrivativa) && Number.isFinite(u.areaGaragem) && Number.isFinite(u.areaComum);
}

function requisitosBase(trabalho: Process): RequisitoCheck[] {
  const t = trabalho.tecnico;
  return [
    { label: 'Unidades cadastradas', ok: !!t?.units && t.units.length > 0, nivel: 'bloqueante' },
    { label: 'Área do terreno informada', ok: !!t?.semFracao || (t?.terreno || 0) > 0, nivel: 'bloqueante' },
  ];
}

export const DOCUMENT_REGISTRY: DocumentTemplate[] = [
  {
    slug: 'memorial',
    label: 'Memorial Descritivo',
    descricao: 'Fração ideal e descrição dos pavimentos',
    icon: '📄',
    grupo: 'Descritivo',
    disponivel: true,
    requisitos: requisitosBase,
  },
  {
    slug: 'abnt',
    label: 'Quadro NBR 12721',
    descricao: 'Custo de construção e áreas reais — Frações Ideais (ABNT IV-A/IV-B)',
    icon: '📊',
    grupo: 'Cálculo',
    disponivel: true,
    requisitos: trabalho => [
      ...requisitosBase(trabalho),
      { label: 'Áreas privativa/garagem/comum numéricas em todas as unidades', ok: (trabalho.tecnico?.units || []).every(unidadeTemAreaValida), nivel: 'bloqueante' },
    ],
  },
  {
    slug: 'instituicao',
    label: 'Instituição de Condomínio',
    descricao: 'Qualificação, terreno e unidades',
    icon: '🏛️',
    grupo: 'Condomínio',
    disponivel: true,
    requisitos: trabalho => [...requisitosBase(trabalho), { label: 'Matrícula do imóvel', ok: !!trabalho.tecnico?.matricula, nivel: 'aviso' }],
  },
  {
    slug: 'convencao',
    label: 'Convenção de Condomínio',
    descricao: 'Regras de convivência e administração',
    icon: '📜',
    grupo: 'Condomínio',
    disponivel: true,
    requisitos: requisitosBase,
  },
  {
    slug: 'instituicao_simplificada',
    label: 'Instituição Simplificada',
    descricao: 'Especificação simplificada de condomínio (unidades sem habite-se/matrícula unificada)',
    icon: '🏢',
    grupo: 'Condomínio',
    disponivel: true,
    requisitos: trabalho => [...requisitosBase(trabalho), { label: 'Matrícula-mãe do imóvel', ok: !!trabalho.tecnico?.matricula, nivel: 'aviso' }],
  },
  {
    slug: 'laudo',
    label: 'Laudo de Habitabilidade',
    descricao: 'Vistoria e declaração de conformidade',
    icon: '✅',
    grupo: 'Laudo',
    disponivel: true,
    requisitos: trabalho => [{ label: 'Unidades cadastradas', ok: !!trabalho.tecnico?.units?.length, nivel: 'bloqueante' }],
  },
  {
    slug: 'requerimento',
    label: 'Requerimento',
    descricao: 'Requerimento de especificação simplificada para protocolo no Cartório de Imóveis',
    icon: '🖋️',
    grupo: 'Protocolo',
    disponivel: true,
    requisitos: trabalho => [{ label: 'Pelo menos um ato registral selecionado', ok: !!(trabalho.tecnico?.atosRegistraisRequerimento || []).length, nivel: 'aviso' }],
  },
  {
    slug: 'requerimento_averbacao',
    label: 'Requerimento de Averbação',
    descricao: 'Prepare o requerimento para averbação de construção, ampliação, reforma ou regularização da edificação.',
    icon: '🏗️',
    grupo: 'Registro/Regularização',
    disponivel: true,
    requisitos: () => [],
  },
];

export function buscarTemplate(slug: TipoDocumentoTecnico): DocumentTemplate {
  const template = DOCUMENT_REGISTRY.find(d => d.slug === slug);
  if (!template) throw new Error(`Documento desconhecido: ${slug}`);
  return template;
}
