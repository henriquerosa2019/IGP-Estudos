import { 
  LayoutDashboard, 
  Calendar, 
  BookOpen, 
  MessageSquare, 
  Settings, 
  LogOut,
  GraduationCap,
  Timer,
  FileText
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Editais", path: "/editais" },
  { icon: Calendar, label: "Plano de Estudos", path: "/plano" },
  { icon: BookOpen, label: "Flashcards", path: "/flashcards" },
  { icon: MessageSquare, label: "Tutor IA", path: "/tutor" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-64 h-screen bg-zinc-950 text-zinc-400 flex flex-col border-r border-zinc-800">
      <div className="p-6 flex flex-col items-center justify-center mb-2">
        <img 
          src="https://www.dropbox.com/scl/fi/r0kvtpyqeb86r34575k6r/kverna.PNG?rlkey=oswgo2suwgyx4yms3jtrpuhn1&st=0tj8q1se&raw=1" 
          alt="Kverna Logo" 
          className="h-32 w-auto object-contain"
          referrerPolicy="no-referrer"
        />
        <span className="mt-4 font-bold text-red-600 text-lg tracking-wide">Kverna Concurso</span>
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

      <div className="p-4 mx-4 mb-4 bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-zinc-200">
            <Timer className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Pomodoro</span>
          </div>
          <span className="text-xs font-mono text-red-600">{formatTime(timeLeft)}</span>
        </div>
        <button 
          onClick={() => setIsActive(!isActive)}
          className={cn(
            "w-full py-1.5 rounded-lg text-xs font-bold transition-all",
            isActive 
              ? "bg-zinc-800 text-red-600 hover:bg-zinc-700" 
              : "bg-red-600 text-white hover:bg-red-700"
          )}
        >
          {isActive ? "Pausar" : "Focar Agora"}
        </button>
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-1">
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
