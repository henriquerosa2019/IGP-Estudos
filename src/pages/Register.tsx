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
  UserPlus, 
  Mail, 
  Phone, 
  IdCard, 
  CreditCard, 
  BookOpen, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc
} from "firebase/firestore";
import { toast } from "sonner";
import { 
  validateCPF, 
  validateWhatsApp, 
  validateEmail, 
  generateTempPassword 
} from "@/lib/validations";

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    cpf: "",
    whatsapp: "",
    email: "",
    enrolledContest: "",
    paymentMethod: "Cartão de Crédito"
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    // Clear error when user starts typing
    if (errors[id]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });
    }
  };

  const validate = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Nome é obrigatório";
    if (!formData.surname.trim()) newErrors.surname = "Sobrenome é obrigatório";
    
    if (!validateEmail(formData.email)) {
      newErrors.email = "E-mail inválido";
    }

    if (!validateCPF(formData.cpf)) {
      newErrors.cpf = "CPF inválido";
    }

    if (!validateWhatsApp(formData.whatsapp)) {
      newErrors.whatsapp = "WhatsApp inválido (mínimo 10 dígitos)";
    }

    if (!formData.enrolledContest.trim()) {
      newErrors.enrolledContest = "Informe o concurso";
    }

    // Check for duplicates in Firestore
    if (Object.keys(newErrors).length === 0) {
      try {
        // Check CPF
        const cpfQuery = query(collection(db, "users"), where("cpf", "==", formData.cpf));
        const cpfSnap = await getDocs(cpfQuery);
        if (!cpfSnap.empty) {
          newErrors.cpf = "Este CPF já está cadastrado";
        }

        // Check WhatsApp
        const waQuery = query(collection(db, "users"), where("whatsapp", "==", formData.whatsapp));
        const waSnap = await getDocs(waQuery);
        if (!waSnap.empty) {
          newErrors.whatsapp = "Este WhatsApp já está cadastrado";
        }

        // Check Email
        const emailQuery = query(collection(db, "users"), where("email", "==", formData.email));
        const emailSnap = await getDocs(emailQuery);
        if (!emailSnap.empty) {
          newErrors.email = "Este e-mail já está cadastrado";
        }
      } catch (e) {
        console.error("Erro na validação de duplicidade:", e);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const allowedEmails = ["henrique.rosa@poli.ufrj.br", "brunool.rj@gmail.com"];
    const fixedPassword = "Ad16eoh28@=";

    if (!allowedEmails.includes(formData.email.toLowerCase())) {
      toast.error("Nao autorizado!!!");
      // Log attempt
      try {
        await addDoc(collection(db, "unauthorized_attempts"), {
          email: formData.email,
          timestamp: new Date().toISOString(),
          details: {
            name: formData.name,
            surname: formData.surname,
            whatsapp: formData.whatsapp,
            cpf: formData.cpf
          }
        });
      } catch (err) {
        console.error("Erro ao logar tentativa não autorizada:", err);
      }
      return;
    }

    const isValid = await validate();
    if (!isValid) return;

    setLoading(true);
    setTempPassword(fixedPassword);

    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        fixedPassword
      );
      const user = userCredential.user;

      // 2. Create Firestore Profile
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        ...formData,
        role: formData.email === "henrique.rosa@poli.ufrj.br" ? "admin" : "user",
        createdAt: new Date().toISOString(),
        status: "active"
      });

      // 4. Sign out (since createUser logs them in)
      await signOut(auth);

      setSuccess(true);
      toast.success("Inscrição realizada com sucesso!");
    } catch (error: any) {
      console.error("Erro no registro:", error);
      if (error.code === 'auth/email-already-in-use') {
        setErrors(prev => ({ ...prev, email: "Este e-mail já está em uso no sistema de autenticação" }));
      } else {
        toast.error("Erro ao realizar inscrição. Verifique os dados e tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-zinc-200 shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-zinc-900">Inscrição Confirmada!</CardTitle>
            <CardDescription className="text-lg">
              Sua conta foi criada com sucesso na **IGP Estudos 2.0**.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-3">
              <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Próximos Passos:
              </h4>
              <p className="text-sm text-indigo-800">
                Sua conta foi ativada para o e-mail: **{formData.email}**.
              </p>
              <p className="text-sm text-indigo-800">
                Você já pode acessar o sistema com sua senha padrão.
              </p>
            </div>

            <div className="p-4 bg-zinc-100 rounded-xl border border-zinc-200">
              <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Credenciais de Acesso</p>
              <div className="space-y-1">
                <p className="text-sm"><strong>Login:</strong> {formData.email}</p>
                <p className="text-sm"><strong>Senha:</strong> <code className="bg-zinc-200 px-1 rounded">{tempPassword}</code></p>
              </div>
            </div>

            <Button className="w-full p-0 bg-indigo-600 hover:bg-indigo-700">
              <Link to="/login" className="flex items-center justify-center w-full h-full py-2">Ir para o Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 py-12">
      <div className="mb-8 flex flex-col items-center">
        <img 
          src="https://www.dropbox.com/scl/fi/t9aw3i5o4av294p5jmcb1/IGP_LOGO_CONCURSOS-removebg-preview.png?rlkey=d7zvuui3a8w2u6a892z93p84u&st=mppckzi9&raw=1" 
          alt="IGP Estudos 2.0 Logo" 
          className="h-48 w-auto object-contain mb-4"
          referrerPolicy="no-referrer"
        />
        <h1 className="text-4xl tracking-wide text-[#FF9900]" style={{ fontFamily: "'Deutsch Gothic', serif" }}>IGP Estudos 2.0</h1>
        <p className="text-zinc-500 mt-2">Inscrição de Novo Aluno</p>
      </div>

      <Card className="max-w-2xl w-full border-zinc-200 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-indigo-600" />
              Formulário de Inscrição
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-zinc-500 p-0">
              <Link to="/editais" className="flex items-center gap-1 px-3 py-1">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Link>
            </Button>
          </div>
          <CardDescription>
            Preencha todos os campos para gerar seu acesso provisório.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center mb-4">
              <p className="text-sm text-zinc-600">
                Já tem uma conta?{" "}
                <Link to="/login" className="text-indigo-600 font-bold hover:underline">
                  Faça Login
                </Link>
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input 
                  id="name" 
                  placeholder="Seu nome" 
                  value={formData.name}
                  onChange={handleChange}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Sobrenome</Label>
                <Input 
                  id="surname" 
                  placeholder="Seu sobrenome" 
                  value={formData.surname}
                  onChange={handleChange}
                  className={errors.surname ? "border-red-500" : ""}
                />
                {errors.surname && <p className="text-xs text-red-500">{errors.surname}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="flex items-center gap-2">
                  <IdCard className="w-4 h-4" /> CPF
                </Label>
                <Input 
                  id="cpf" 
                  placeholder="000.000.000-00" 
                  value={formData.cpf}
                  onChange={handleChange}
                  className={errors.cpf ? "border-red-500" : ""}
                />
                {errors.cpf && <p className="text-xs text-red-500">{errors.cpf}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" /> WhatsApp
                </Label>
                <Input 
                  id="whatsapp" 
                  placeholder="(00) 00000-0000" 
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className={errors.whatsapp ? "border-red-500" : ""}
                />
                {errors.whatsapp && <p className="text-xs text-red-500">{errors.whatsapp}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> E-mail
              </Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com" 
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="enrolledContest" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Concurso Inscrito
                </Label>
                <Input 
                  id="enrolledContest" 
                  placeholder="Ex: Receita Federal" 
                  value={formData.enrolledContest}
                  onChange={handleChange}
                  className={errors.enrolledContest ? "border-red-500" : ""}
                />
                {errors.enrolledContest && <p className="text-xs text-red-500">{errors.enrolledContest}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Forma de Pagamento
                </Label>
                <select 
                  id="paymentMethod"
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                >
                  <option>Cartão de Crédito</option>
                  <option>Boleto Bancário</option>
                  <option>PIX</option>
                  <option>Transferência</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 py-6 text-lg font-bold shadow-lg shadow-indigo-100"
                disabled={loading}
              >
                {loading ? "Processando Inscrição..." : "Finalizar Inscrição"}
              </Button>
              <p className="text-center text-xs text-zinc-500 mt-4">
                Ao se inscrever, você concorda com nossos termos de uso e política de privacidade.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
