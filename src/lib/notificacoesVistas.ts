/** Notificações são recalculadas ao vivo (não existem como registro persistido) — "limpar" aqui
 *  não apaga a pendência real, só some com o número vermelho do sino pros itens que você já viu.
 *  Se o conteúdo de um item mudar (ex.: de "3 tarefas atrasadas" pra "4"), ele volta a contar como
 *  novo — a assinatura inclui título+descrição, não só o id. */
const CHAVE = 'hbs_notificacoes_vistas';

function lerVistos(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE) || '[]'));
  } catch {
    return new Set();
  }
}

export function assinaturaItem(id: string, title: string, sub: string): string {
  return `${id}|${title}|${sub}`;
}

export function contarNaoVistos<T extends { id: string; title: string; sub: string }>(items: T[]): number {
  const vistos = lerVistos();
  return items.filter(i => !vistos.has(assinaturaItem(i.id, i.title, i.sub))).length;
}

export function marcarTodosVistos<T extends { id: string; title: string; sub: string }>(items: T[]): void {
  localStorage.setItem(CHAVE, JSON.stringify(items.map(i => assinaturaItem(i.id, i.title, i.sub))));
}
