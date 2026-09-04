import { useEffect } from 'react';

/** Troca o <title> da aba enquanto a página estiver montada — é o nome que o navegador
 *  sugere ao "Imprimir / Salvar como PDF". Restaura o título anterior ao desmontar. */
export function usePrintTitle(titulo: string | null | undefined) {
  useEffect(() => {
    if (!titulo) return;
    const anterior = document.title;
    document.title = titulo;
    return () => { document.title = anterior; };
  }, [titulo]);
}
