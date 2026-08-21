import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { AuthProvider } from "@/hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import CadastroPage from "./pages/CadastroPage";
import InicioPage from "./pages/DashboardPage";
import ClientesPage from "./pages/ClientesPage";
import ClienteDetailPage from "./pages/ClienteDetailPage";
import TrabalhosPage from "./pages/TrabalhosPage";
import TrabalhoDetailPage from "./pages/TrabalhoDetailPage";
import TarefasPage from "./pages/TarefasPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import MaisPage from "./pages/MaisPage";
import ProducaoPage from "./pages/ProducaoPage";
import DocumentoGeradorPage from "./pages/producao/DocumentoGeradorPage";
import ComercialPage from "./pages/ComercialPage";
import PropostaImpressaoPage from "./pages/comercial/PropostaImpressaoPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import CaixaLayout from "./pages/financeiro/FinanceiroLayout";
import CaixaVisaoGeralPage from "./pages/financeiro/VisaoGeralPage";
import CaixaMovimentacoesPage from "./pages/financeiro/MovimentacoesPage";
import CaixaContasPage from "./pages/financeiro/ContasPage";
import CaixaParceirosPage from "./pages/financeiro/ParceirosPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<InicioPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/clientes/:clienteId" element={<ClienteDetailPage />} />
            <Route path="/trabalhos" element={<TrabalhosPage />} />
            <Route path="/trabalhos/:trabalhoId" element={<TrabalhoDetailPage />} />
            <Route path="/projetos" element={<Navigate to="/trabalhos" replace />} />
            <Route path="/processos" element={<Navigate to="/trabalhos" replace />} />
            <Route path="/producao" element={<ProducaoPage />} />
            <Route path="/producao/:trabalhoId/:tipo" element={<DocumentoGeradorPage />} />
            <Route path="/documentos" element={<Navigate to="/producao" replace />} />
            <Route path="/comercial" element={<ComercialPage />} />
            <Route path="/comercial/propostas/:propostaId/imprimir" element={<PropostaImpressaoPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/tarefas" element={<TarefasPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/mais" element={<MaisPage />} />

            <Route path="/caixa" element={<CaixaLayout />}>
              <Route index element={<Navigate to="/caixa/visao-geral" replace />} />
              <Route path="visao-geral" element={<CaixaVisaoGeralPage />} />
              <Route path="fluxo-de-caixa" element={<Navigate to="/caixa/visao-geral" replace />} />
              <Route path="receitas" element={<CaixaMovimentacoesPage />} />
              <Route path="despesas" element={<Navigate to="/caixa/receitas" replace />} />
              <Route path="contas" element={<CaixaContasPage />} />
              <Route path="parceiros" element={<CaixaParceirosPage />} />
            </Route>
            <Route path="/financeiro/*" element={<Navigate to="/caixa" replace />} />

            <Route path="*" element={<NotFound />} />
          </Route>
          </Route>
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
