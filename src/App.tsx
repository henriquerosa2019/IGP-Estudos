import { 
  BrowserRouter as Router, 
  Routes, 
  Route 
} from "react-router-dom";
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
  return (
    <Router>
      <Toaster position="top-right" expand={false} richColors />
      <Analytics />
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
    </Router>
  );
}
