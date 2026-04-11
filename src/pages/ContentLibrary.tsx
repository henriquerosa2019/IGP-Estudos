import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  FileText, 
  Video, 
  Type, 
  Download, 
  ExternalLink, 
  BrainCircuit, 
  Trash2,
  Filter,
  MoreVertical,
  Loader2,
  BookOpen,
  Sparkles
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { auth, db, storage, handleFirestoreError, OperationType } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { ContentItem } from "@/types";
import { analyzeContent, generateFlashcardsFromMultimodal } from "@/lib/gemini";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default function ContentLibrary() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "subject">("date");
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<'pdf' | 'text' | 'video'>('text');
  const [newContent, setNewContent] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [existingSubjects, setExistingSubjects] = useState<string[]>([]);
  const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const uid = user?.uid || localStorage.getItem('localUid');
    if (!uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "contentItems"),
      where("uid", "==", uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contentItems: ContentItem[] = [];
      const subjectsSet = new Set<string>();
      
      snapshot.forEach((doc) => {
        const data = doc.data() as ContentItem;
        contentItems.push({ ...data, id: doc.id });
        if (data.subject) subjectsSet.add(data.subject);
      });
      
      setItems(contentItems);
      setExistingSubjects(Array.from(subjectsSet));
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "contentItems");
    });

    return () => unsubscribe();
  }, [authReady, user]);

  const handleUpload = async () => {
    if (!newTitle || !newSubject) {
      toast.error("Por favor, preencha o título e a disciplina.");
      return;
    }

    setUploadLoading(true);
    const uid = user?.uid || localStorage.getItem('localUid');

    try {
      let contentValue = newContent;

      if (newType === 'pdf' && newFile) {
        const storageRef = ref(storage, `content/${uid}/${Date.now()}_${newFile.name}`);
        const uploadResult = await uploadBytes(storageRef, newFile);
        contentValue = await getDownloadURL(uploadResult.ref);
      }

      // IA Analysis (Optional but recommended)
      let analysis = { summary: "", topics: [] as string[] };
      try {
        // If it's text, we can analyze it directly
        if (newType === 'text') {
          const result = await analyzeContent(newContent, 'text');
          analysis = { summary: result.summary, topics: result.topics };
        }
      } catch (e) {
        console.warn("AI Analysis failed", e);
      }

      await addDoc(collection(db, "contentItems"), {
        uid,
        title: newTitle,
        type: newType,
        content: contentValue,
        subject: newSubject,
        createdAt: new Date().toISOString(),
        summary: analysis.summary,
        topics: analysis.topics
      });

      toast.success("Conteúdo adicionado com sucesso!");
      setIsUploadOpen(false);
      resetUploadForm();
    } catch (error) {
      console.error("Error uploading content:", error);
      toast.error("Erro ao adicionar conteúdo.");
    } finally {
      setUploadLoading(false);
    }
  };

  const resetUploadForm = () => {
    setNewTitle("");
    setNewType('text');
    setNewContent("");
    setNewFile(null);
    setNewSubject("");
    setIsCreatingNewSubject(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este conteúdo?")) return;
    try {
      await deleteDoc(doc(db, "contentItems", id));
      toast.success("Conteúdo excluído.");
    } catch (error) {
      toast.error("Erro ao excluir conteúdo.");
    }
  };

  const handleGenerateFlashcards = async (item: ContentItem) => {
    toast.promise(
      (async () => {
        let textToProcess = item.content;
        
        if (item.type === 'pdf') {
          // For PDF, we'd ideally extract text. For now, we'll use the title and summary if available
          textToProcess = `Conteúdo: ${item.title}\nResumo: ${item.summary || ''}\nTópicos: ${(item.topics || []).join(', ')}`;
        } else if (item.type === 'video') {
          // For video, we'd need transcription. For now, use title
          textToProcess = `Vídeo sobre: ${item.title}`;
        }

        const parts = [{ text: textToProcess }];
        const generatedCards = await generateFlashcardsFromMultimodal(parts, item.title);
        
        const uid = user?.uid || localStorage.getItem('localUid');
        
        // Save to library (localStorage for now to match existing logic, or Firestore if you prefer)
        const savedDecksStr = localStorage.getItem('flashcardDecks');
        const savedDecks = savedDecksStr ? JSON.parse(savedDecksStr) : [];
        
        const newDeck = {
          id: `deck-${Date.now()}`,
          name: `IA: ${item.title}`,
          cards: generatedCards.map((c: any) => ({
            ...c,
            id: `card-${Math.random().toString(36).substring(2, 11)}`,
            subject: item.subject,
            difficulty: 'medium'
          }))
        };
        
        localStorage.setItem('flashcardDecks', JSON.stringify([...savedDecks, newDeck]));
        
        return "Flashcards gerados e salvos na biblioteca!";
      })(),
      {
        loading: 'IA processando conteúdo e gerando flashcards...',
        success: (data) => data,
        error: 'Erro ao gerar flashcards.'
      }
    );
  };

  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterSubject === "all" || item.subject === filterSubject;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "subject") return a.subject.localeCompare(b.subject);
      return 0;
    });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            Acervo Inteligente
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Organize seus materiais por disciplina e gere flashcards com IA.</p>
        </div>
        
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger className={cn(
            buttonVariants({ variant: "default" }),
            "bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
          )}>
            <Plus className="w-4 h-4" /> Adicionar Conteúdo
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Novo Conteúdo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input 
                  placeholder="Ex: Resumo de Direito Penal - Parte 1" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Disciplina</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] text-indigo-600 gap-1"
                    onClick={async () => {
                      if (!newContent && !newFile) {
                        toast.error("Adicione conteúdo primeiro para a IA analisar.");
                        return;
                      }
                      toast.promise(
                        (async () => {
                          let textToAnalyze = newContent;
                          if (newType === 'pdf' && newFile) {
                            textToAnalyze = `Arquivo: ${newFile.name}`; // Limited for now
                          }
                          const result = await analyzeContent(textToAnalyze, newType);
                          setNewSubject(result.suggestedSubject);
                          if (!newTitle) setNewTitle(result.topics[0] || "");
                          return `Sugestão: ${result.suggestedSubject}`;
                        })(),
                        {
                          loading: 'IA analisando...',
                          success: (data) => data,
                          error: 'Erro na análise.'
                        }
                      );
                    }}
                  >
                    <Sparkles className="w-3 h-3" /> Sugerir com IA
                  </Button>
                </div>
                <div className="flex gap-2">
                  {!isCreatingNewSubject ? (
                    <Select 
                      value={newSubject} 
                      onValueChange={(val) => {
                        if (val === "_new") {
                          setIsCreatingNewSubject(true);
                          setNewSubject("");
                        } else {
                          setNewSubject(val);
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione ou crie uma..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingSubjects.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                        <SelectItem value="_new" className="text-indigo-600 font-bold">+ Criar Nova Disciplina</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      placeholder="Nome da nova disciplina..." 
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      autoFocus
                    />
                  )}
                  {isCreatingNewSubject && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setIsCreatingNewSubject(false);
                      setNewSubject("");
                    }}>Voltar</Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant={newType === 'text' ? 'default' : 'outline'} 
                    onClick={() => setNewType('text')}
                    className="gap-2"
                  >
                    <Type className="w-4 h-4" /> Texto
                  </Button>
                  <Button 
                    variant={newType === 'pdf' ? 'default' : 'outline'} 
                    onClick={() => setNewType('pdf')}
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" /> PDF
                  </Button>
                  <Button 
                    variant={newType === 'video' ? 'default' : 'outline'} 
                    onClick={() => setNewType('video')}
                    className="gap-2"
                  >
                    <Video className="w-4 h-4" /> Vídeo
                  </Button>
                </div>
              </div>

              {newType === 'text' && (
                <div className="space-y-2">
                  <Label>Conteúdo (Texto)</Label>
                  <Textarea 
                    placeholder="Cole seu texto aqui..." 
                    className="min-h-[150px]"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                  />
                </div>
              )}

              {newType === 'pdf' && (
                <div className="space-y-2">
                  <Label>Arquivo PDF</Label>
                  <Input 
                    type="file" 
                    accept=".pdf" 
                    onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}

              {newType === 'video' && (
                <div className="space-y-2">
                  <Label>Link do Vídeo (YouTube)</Label>
                  <Input 
                    placeholder="https://youtube.com/watch?v=..." 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
              <Button 
                onClick={handleUpload} 
                disabled={uploadLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar Conteúdo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Buscar por título ou disciplina..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-zinc-400" />
                  <SelectValue placeholder="Disciplina" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Disciplinas</SelectItem>
                {existingSubjects.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Data (Novo)</SelectItem>
                <SelectItem value="title">Título (A-Z)</SelectItem>
                <SelectItem value="subject">Disciplina</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
          <p className="text-zinc-500">Carregando seu acervo...</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id}>
              <Card className="group hover:border-indigo-300 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden flex flex-col h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600">
                      {item.type === 'pdf' ? <FileText className="w-5 h-5" /> : 
                       item.type === 'video' ? <Video className="w-5 h-5" /> : 
                       <Type className="w-5 h-5" />}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        "h-8 w-8 p-0"
                      )}>
                        <MoreVertical className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3">
                    <Badge variant="secondary" className="mb-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-none">
                      {item.subject}
                    </Badge>
                    <CardTitle className="text-lg font-bold leading-tight group-hover:text-indigo-600 transition-colors">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Adicionado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {item.summary && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-4 italic">
                      "{item.summary}"
                    </p>
                  )}

                  {item.topics && item.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {item.topics.slice(0, 3).map((t, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] py-0 h-4 border-zinc-200 text-zinc-500">
                          {t}
                        </Badge>
                      ))}
                      {item.topics.length > 3 && (
                        <span className="text-[9px] text-zinc-400">+{item.topics.length - 3}</span>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-auto pt-4 flex flex-wrap gap-2">
                    {item.type === 'pdf' ? (
                      <a 
                        href={item.content} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "flex-1 gap-2"
                        )}
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar
                      </a>
                    ) : (
                      <a 
                        href={item.type === 'video' ? item.content : '#'} 
                        target={item.type === 'video' ? "_blank" : "_self"} 
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "flex-1 gap-2"
                        )}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir
                      </a>
                    )}
                    
                    <Button 
                      className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" 
                      size="sm"
                      onClick={() => handleGenerateFlashcards(item)}
                    >
                      <BrainCircuit className="w-3.5 h-3.5" /> Flashcards
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="bg-white dark:bg-zinc-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <BookOpen className="w-8 h-8 text-zinc-300" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Nenhum conteúdo encontrado</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mt-2">
            Comece adicionando PDFs, textos ou vídeos para organizar seu acervo inteligente.
          </p>
          <Button 
            variant="outline" 
            className="mt-6 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            onClick={() => setIsUploadOpen(true)}
          >
            Adicionar Primeiro Conteúdo
          </Button>
        </div>
      )}
    </div>
  );
}
