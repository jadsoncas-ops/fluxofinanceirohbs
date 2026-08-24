import { useEffect, useState } from 'react';

/** Modo privacidade global — esconde valores em R$ na tela inteira (útil pra compartilhar a tela
 *  sem expor números). Preferência só de UI, guardada no navegador — não sincroniza via Supabase. */
const CHAVE = 'hbs_valores_ocultos';
let ocultos = localStorage.getItem(CHAVE) === '1';
const listeners = new Set<() => void>();

export function getValoresOcultos() {
  return ocultos;
}

export function toggleValoresOcultos() {
  ocultos = !ocultos;
  localStorage.setItem(CHAVE, ocultos ? '1' : '0');
  listeners.forEach(l => l());
}

export function useValoresOcultos(): boolean {
  const [v, setV] = useState(ocultos);
  useEffect(() => {
    const listener = () => setV(ocultos);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return v;
}
