import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Sem isso, qualquer erro de render (comum quando o app fica com JavaScript antigo em cache —
 *  típico de tablet/celular que não recarrega sozinho há dias) derruba a árvore inteira do React
 *  e vira tela branca, sem explicação nem saída pro usuário. Estilo inline de propósito — não pode
 *  depender de nada que possa estar quebrado (Tailwind, outros componentes). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Erro capturado pelo ErrorBoundary:', error, info);
  }

  async handleReload() {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((regs || []).map(r => r.unregister()));
      const keys = await caches?.keys();
      await Promise.all((keys || []).map(k => caches.delete(k)));
    } catch {
      // segue pro reload mesmo se a limpeza falhar
    }
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#09090b', color: '#fff' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Algo deu errado nesta tela.</div>
        <div style={{ fontSize: 13, color: '#a1a1aa', maxWidth: 340, lineHeight: 1.5 }}>
          Isso costuma acontecer quando o app fica muito tempo aberto sem atualizar. Toque no botão abaixo pra recarregar do zero.
        </div>
        <button
          onClick={() => this.handleReload()}
          style={{ height: 42, padding: '0 22px', borderRadius: 8, background: '#fff', color: '#09090b', fontSize: 13, fontWeight: 600, border: 'none' }}
        >
          Recarregar
        </button>
      </div>
    );
  }
}
