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
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { toast } from "sonner";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: HelpCircle, label: "Comece aqui", path: "/comece-aqui" },
  { icon: FileText, label: "Editais", path: "/editais" },
  { icon: Calendar, label: "Plano de Estudos", path: "/plano" },
  { icon: BookOpen, label: "Acervo Inteligente", path: "/acervo" },
  { icon: Layers, label: "Flashcards", path: "/flashcards" },
  { icon: MessageSquare, label: "IgpAI", path: "/tutor" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    setIsDark(document.documentElement.classList.contains('dark'));
    
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
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
      <div className="p-6 flex flex-col items-center justify-center mb-2 bg-zinc-900/50">
        <div className="border border-[#FF9900] p-0.5 rounded-full mb-4 shadow-sm bg-white">
          <img 
            src="https://www.dropbox.com/scl/fi/t9aw3i5o4av294p5jmcb1/IGP_LOGO_CONCURSOS-removebg-preview.png?rlkey=d7zvuui3a8w2u6a892z93p84u&st=mppckzi9&raw=1" 
            alt="IGP Estudos 2.0 Logo" 
            className="h-24 w-24 object-contain rounded-full"
            referrerPolicy="no-referrer"
          />
        </div>
        <span className="text-[#FF9900] text-xl font-bold tracking-wide text-center" style={{ fontFamily: "'Deutsch Gothic', serif" }}>IGP Estudos 2.0</span>
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
                ? "bg-zinc-900 text-[#FF9900]" 
                : "hover:bg-zinc-900 hover:text-[#FF9900]"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-2 mx-3 mb-2 bg-black rounded-md border border-red-900/50 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[#FF9900]">
            <Timer className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Pomodoro</span>
          </div>
          <span className="text-xs font-mono font-bold text-[#FF9900]">{formatTime(timeLeft)}</span>
        </div>
        <button 
          onClick={() => setIsActive(!isActive)}
          className={cn(
            "w-full py-1 rounded text-[10px] font-bold transition-all uppercase tracking-widest",
            isActive 
              ? "bg-zinc-900 text-[#FF9900] border border-red-900/50 hover:bg-zinc-800" 
              : "bg-black text-[#FF9900] hover:bg-zinc-900 shadow-md shadow-black/20 border border-zinc-800"
          )}
        >
          {isActive ? "Pausar" : "Focar"}
        </button>
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-1">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-zinc-900 hover:text-[#FF9900] text-zinc-400"
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
              ? "bg-zinc-900 text-[#FF9900]" 
              : "hover:bg-zinc-900 hover:text-[#FF9900]"
          )}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Configurações</span>
        </Link>
        {user ? (
          <div className="space-y-1">
            <div className="px-3 py-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">
              Logado como: {user.email}
            </div>
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
              <span className="font-medium">Sair da Conta</span>
            </button>
          </div>
        ) : (
          <Link 
            to="/login"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
          >
            <GraduationCap className="w-5 h-5" />
            <span className="font-medium">Entrar / Login</span>
          </Link>
        )}
        
        <div className="mt-4 pt-4 border-t border-zinc-800/50 flex flex-col items-center gap-1">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">Versão do Sistema</span>
          <span className="text-xs text-zinc-500 font-mono">v1.0.9-stable</span>
        </div>
      </div>
    </div>
  );
}
