import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";
import "./styles/documento-print.css";

// Apply saved theme before render to avoid flash
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}

registerSW({ immediate: true });

// registerType "autoUpdate" troca o Service Worker por baixo dos panos sem avisar — se isso
// acontecer com a página aberta (comum em tablet/celular, que fica com o app aberto por dias),
// o JavaScript antigo continua rodando em cima de um cache novo e quebra de formas estranhas
// (tela branca, botão que não faz nada). Recarregar uma vez assim que o novo SW assume evita isso.
if ('serviceWorker' in navigator) {
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
