import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import "./styles/documento-print.css";

// Apply saved theme before render to avoid flash
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
