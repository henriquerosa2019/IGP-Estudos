import { 
  LayoutDashboard, 
  Calendar, 
  BookOpen, 
  MessageSquare, 
  Settings, 
  LogOut,
  GraduationCap,
  Timer,
  FileText,
  Layers,
  Moon,
  Sun,
  HelpCircle
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: HelpCircle, label: "Comece aqui", path: "/comece-aqui" },
  { icon: FileText, label: "Editais", path: "/editais" },
  { icon: Calendar, label: "Plano de Estudos", path: "/plano" },
  { icon: BookOpen, label: "Acervo Inteligente", path: "/acervo" },
  { icon: Layers, label: "Flashcards", path: "/flashcards" },
  { icon: MessageSquare, label: "KvernAI", path: "/tutor" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-64 h-screen bg-zinc-950 text-zinc-400 flex flex-col border-r border-zinc-800">
      <div className="p-6 flex flex-col items-center justify-center mb-2">
        <img 
          src="https://www.dropbox.com/scl/fi/buu29rs0lp3l1j21fm3yz/kverna-removebg-preview.png?rlkey=j8t4uqgb0ec2x0xjm83jwn13z&st=utvwkcjt&raw=1" 
          alt="Kverna Logo" 
          className="h-48 w-auto object-contain"
          referrerPolicy="no-referrer"
        />
        <span className="mt-4 text-red-600 text-2xl tracking-wide" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Kverna Concurso 2.0</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === item.path 
                ? "bg-zinc-900 text-red-600" 
                : "hover:bg-zinc-900 hover:text-red-600"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-2 mx-3 mb-2 bg-black rounded-md border border-red-900/50 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-red-600">
            <Timer className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Pomodoro</span>
          </div>
          <span className="text-xs font-mono font-bold text-red-600">{formatTime(timeLeft)}</span>
        </div>
        <button 
          onClick={() => setIsActive(!isActive)}
          className={cn(
            "w-full py-1 rounded text-[10px] font-bold transition-all uppercase tracking-widest",
            isActive 
              ? "bg-zinc-900 text-red-600 border border-red-900/50 hover:bg-zinc-800" 
              : "bg-red-700 text-white hover:bg-red-600 shadow-md shadow-red-900/20"
          )}
        >
          {isActive ? "Pausar" : "Focar"}
        </button>
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-1">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-zinc-900 hover:text-red-600 text-zinc-400"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="font-medium">Trocar Tela</span>
        </button>
        <Link 
          to="/configuracoes"
          onClick={onClose}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
            location.pathname === "/configuracoes" 
              ? "bg-zinc-900 text-red-600" 
              : "hover:bg-zinc-900 hover:text-red-600"
          )}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Configurações</span>
        </Link>
        <button 
          onClick={async () => {
            if (onClose) onClose();
            try {
              await signOut(auth);
              toast.success("Sessão encerrada.");
            } catch (error) {
              toast.error("Erro ao sair.");
            }
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900 hover:text-red-600 transition-colors text-red-600"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}
