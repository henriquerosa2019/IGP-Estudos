import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  LogIn, 
  Mail, 
  Lock,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "firebase/auth";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Informe seu e-mail.");
      return;
    }
    if (!password) {
      toast.error("Informe sua senha.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Login realizado com sucesso!");
      navigate("/");
    } catch (error: any) {
      console.error("Erro no login:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error("E-mail ou senha incorretos. Se você sempre entrou pelo Google, continue usando o botão do Google abaixo.");
      } else if (error.code === 'auth/too-many-requests') {
        toast.error("Muitas tentativas sem sucesso. Tente novamente mais tarde ou recupere sua senha.");
      } else {
        toast.error("Erro ao realizar login: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Digite seu e-mail no campo acima para receber o link de recuperação.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      console.error("Erro reset senha:", error);
      toast.error("Erro ao enviar e-mail de recuperação. Verifique se o e-mail está correto.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Login com Google realizado!");
      navigate("/");
    } catch (error) {
      console.error("Erro Google Login:", error);
      toast.error("Falha ao entrar com Google.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 py-12">
      <div className="mb-8 flex flex-col items-center">
        <img 
          src="https://www.dropbox.com/scl/fi/buu29rs0lp3l1j21fm3yz/kverna-removebg-preview.png?rlkey=j8t4uqgb0ec2x0xjm83jwn13z&st=utvwkcjt&raw=1" 
          alt="Kverna Logo" 
          className="h-48 w-auto object-contain mb-4"
          referrerPolicy="no-referrer"
        />
        <h1 className="text-4xl tracking-wide text-red-600" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Kverna Concurso 2.0</h1>
        <p className="text-zinc-500 mt-2">Acesso ao Portal do Aluno</p>
      </div>

      <Card className="max-w-md w-full border-zinc-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="w-6 h-6 text-indigo-600" />
            Entrar
          </CardTitle>
          <CardDescription>
            Use suas credenciais para acessar o plano de estudos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 py-6 text-lg font-bold shadow-lg shadow-indigo-100"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            
            <div className="text-right">
              <button 
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-xs text-zinc-500 hover:text-indigo-600 hover:underline"
              >
                {resetLoading ? "Enviando..." : "Esqueceu a senha?"}
              </button>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-500">Ou continue com</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full py-6 border-zinc-200 hover:bg-zinc-50"
            onClick={handleGoogleLogin}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-2" alt="Google" />
            Entrar com Google
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-zinc-600">
              Não tem uma conta?{" "}
              <Link to="/registrar" className="text-indigo-600 font-bold hover:underline">
                Inscreva-se agora
              </Link>
            </p>
          </div>

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Atenção:</strong> Se este for seu primeiro acesso, verifique seu e-mail para definir sua senha definitiva através do link de ativação.
              </p>
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Dica:</strong> Para visualizar as aulas importadas, certifique-se de estar logado na sua conta Hotmart no navegador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
