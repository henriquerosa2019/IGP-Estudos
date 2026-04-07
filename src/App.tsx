import { 
  BrowserRouter as Router, 
  Routes, 
  Route 
} from "react-router-dom";
import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Notices from "./pages/Notices";
import StudyPlan from "./pages/StudyPlan";
import Flashcards from "./pages/Flashcards";
import Tutor from "./pages/Tutor";
import Settings from "./pages/Settings";
import Register from "./pages/Register";
import { Toaster } from "sonner";

export default function App() {
  useEffect(() => {
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
    <Router>
      <Toaster position="top-right" expand={false} richColors />
      <Routes>
        <Route path="/registrar" element={<Register />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editais" element={<Notices />} />
          <Route path="/plano" element={<StudyPlan />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/tutor" element={<Tutor />} />
          <Route path="/configuracoes" element={<Settings />} />
        </Route>
      </Routes>
      <Analytics />
    </Router>
  );
}
