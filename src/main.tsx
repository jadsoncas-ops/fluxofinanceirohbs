import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/documento-print.css";

// Apply saved theme before render to avoid flash
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => console.log('SW failed', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
