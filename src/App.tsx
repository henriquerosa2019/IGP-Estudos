import { 
  BrowserRouter as Router, 
  Routes, 
  Route 
} from "react-router-dom";
import { useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import StartHere from "./pages/StartHere";
import Strategy from "./pages/Strategy";
import Notices from "./pages/Notices";
import StudyPlan from "./pages/StudyPlan";
import Flashcards from "./pages/Flashcards";
import ContentLibrary from "./pages/ContentLibrary";
import Tutor from "./pages/Tutor";
import Settings from "./pages/Settings";
import Register from "./pages/Register";
import Login from "./pages/Login";
import { Toaster } from "sonner";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./components/ui/button";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Ops! Algo parou de funcionar</h1>
          <p className="text-zinc-400 mb-6 max-w-md">
            Ocorreu um erro inesperado na interface. Tente recarregar a página ou limpar o cache do navegador.
          </p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Recarregar Página
            </Button>
            <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
              Tentar Novamente
            </Button>
          </div>
          {this.state.error && (
            <pre className="mt-8 p-4 bg-zinc-900 rounded-lg text-left text-[10px] text-red-400 overflow-auto max-w-2xl w-full">
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  useEffect(() => {
    // Initialize theme
    const isDark = localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener('copy', preventCopy);
    document.addEventListener('cut', preventCopy);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('dragstart', preventDrag);

    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('cut', preventCopy);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('dragstart', preventDrag);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Toaster position="top-right" expand={false} richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registrar" element={<Register />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/comece-aqui" element={<StartHere />} />
            <Route path="/estrategia" element={<Strategy />} />
            <Route path="/editais" element={<Notices />} />
            <Route path="/plano" element={<StudyPlan />} />
            <Route path="/acervo" element={<ContentLibrary />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/tutor" element={<Tutor />} />
            <Route path="/configuracoes" element={<Settings />} />
          </Route>
        </Routes>
        <Analytics />
      </Router>
    </ErrorBoundary>
  );
}
