import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  User as UserIcon, 
  Save, 
  CreditCard, 
  Phone, 
  Mail, 
  IdCard, 
  BookOpen,
  UserPlus
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { User } from "@/types";

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    cpf: "",
    whatsapp: "",
    email: "",
    enrolledContest: "",
    paymentMethod: "Cartão de Crédito" // Default
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUser(userData);
          setFormData({
            name: userData.name || "",
            surname: userData.surname || "",
            cpf: userData.cpf || "",
            whatsapp: userData.whatsapp || "",
            email: userData.email || u.email || "",
            enrolledContest: userData.enrolledContest || "",
            paymentMethod: userData.paymentMethod || "Cartão de Crédito"
          });
        } else {
          // New user or first time settings
          setFormData(prev => ({ ...prev, email: u.email || "" }));
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) {
      toast.error("Você precisa estar logado para salvar as configurações.");
      return;
    }

    if (!formData.name || !formData.surname || !formData.email) {
      toast.error("Nome, Sobrenome e E-mail são obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const updatedUser: User = {
        id: auth.currentUser.uid,
        ...formData,
        role: user?.role || 'user'
      };

      await setDoc(userRef, updatedUser, { merge: true });
      setUser(updatedUser);
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!auth.currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="p-6 bg-indigo-50 rounded-full">
          <UserIcon className="w-12 h-12 text-indigo-600" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900">Acesse sua conta</h2>
          <p className="text-zinc-500 max-w-sm">Faça login para gerenciar seu perfil e inscrições.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Configurações do Perfil</h1>
        <p className="text-zinc-500 mt-2">Gerencie suas informações pessoais e dados de inscrição.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Dados Pessoais
              </CardTitle>
              <CardDescription>
                Informações básicas para sua identificação na plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input 
                    id="name" 
                    placeholder="Seu nome" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname">Sobrenome</Label>
                  <Input 
                    id="surname" 
                    placeholder="Seu sobrenome" 
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="flex items-center gap-2">
                    <IdCard className="w-4 h-4" /> CPF
                  </Label>
                  <Input 
                    id="cpf" 
                    placeholder="000.000.000-00" 
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" /> WhatsApp
                  </Label>
                  <Input 
                    id="whatsapp" 
                    placeholder="(00) 00000-0000" 
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
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
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Inscrição e Concurso
              </CardTitle>
              <CardDescription>
                Detalhes sobre o concurso que você está focado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contest">Concurso Inscrito</Label>
                <Input 
                  id="contest" 
                  placeholder="Ex: Receita Federal, PF, etc." 
                  value={formData.enrolledContest}
                  onChange={(e) => setFormData({ ...formData, enrolledContest: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Forma de Pagamento
                </Label>
                <select 
                  id="payment"
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  <option>Cartão de Crédito</option>
                  <option>Boleto Bancário</option>
                  <option>PIX</option>
                  <option>Transferência</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="gap-2 bg-indigo-600 px-8"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>

          {(user?.role === 'admin' || auth.currentUser?.email === 'henrique.rosa@poli.ufrj.br') && (
            <Card className="border-indigo-200 bg-indigo-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <UserPlus className="w-5 h-5" />
                  Painel Administrativo
                </CardTitle>
                <CardDescription>
                  Como administrador, você pode registrar novos alunos diretamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full p-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                  <Link to="/registrar" className="flex items-center justify-center gap-2 w-full h-full py-2">
                    <UserPlus className="w-4 h-4" />
                    Abrir Formulário de Inscrição
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status da Conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                <span className="text-sm text-zinc-500">Tipo de Plano</span>
                <span className="text-sm font-bold text-indigo-600">Premium</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                <span className="text-sm text-zinc-500">Vencimento</span>
                <span className="text-sm font-medium">06/04/2027</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-zinc-500">Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Ativo
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
            <h4 className="font-bold text-indigo-900 mb-2">Precisa de ajuda?</h4>
            <p className="text-sm text-indigo-700 mb-4">
              Se tiver dúvidas sobre sua assinatura ou dados de pagamento, entre em contato com nosso suporte.
            </p>
            <Button variant="outline" className="w-full bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              Falar com Suporte
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
