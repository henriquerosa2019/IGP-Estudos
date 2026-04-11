import { useState, useEffect, useRef } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlashcardMetrics } from "@/components/FlashcardMetrics";
import { 
  RotateCcw, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Layers,
  Loader2,
  BrainCircuit,
  Save,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Upload,
  Link as LinkIcon,
  FileText,
  Image as ImageIcon,
  Youtube,
  Search,
  Plus,
  BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateFlashcardsFromMultimodal } from "@/lib/gemini";
import { toast } from "sonner";
import Markdown from "react-markdown";
import { db, auth, handleFirestoreError, OperationType } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Flashcard {
  id?: string;
  question: string;
  answer: string;
  subject: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  deckId?: string;
  cardId?: string;
}

interface FlashcardDeck {
  id: string;
  name: string;
  cards: Flashcard[];
}

interface FlashcardReview {
  id?: string;
  uid: string;
  question: string;
  answer: string;
  subject: string;
  status: 'easy' | 'medium' | 'hard';
  nextReviewDate: string;
  createdAt: string;
  deckId?: string;
  cardId?: string;
}

type ContentSource = 
  | { id: string; type: 'topic'; text: string }
  | { id: string; type: 'file'; file: File }
  | { id: string; type: 'link'; url: string };

export default function Flashcards() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [view, setView] = useState<'list' | 'study' | 'review' | 'metrics'>('list');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [savedDecks, setSavedDecks] = useState<FlashcardDeck[]>([]);
  const [topic, setTopic] = useState("");
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
  
  const [deckName, setDeckName] = useState("");
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [showTopicInput, setShowTopicInput] = useState(false);
  
  const [allReviews, setAllReviews] = useState<FlashcardReview[]>([]);
  const [reviewsEasy, setReviewsEasy] = useState<FlashcardReview[]>([]);
  const [reviewsMedium, setReviewsMedium] = useState<FlashcardReview[]>([]);
  const [reviewsHard, setReviewsHard] = useState<FlashcardReview[]>([]);
  const [reviewMode, setReviewMode] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const [user, setUser] = useState<any>(null);

  const getUid = () => {
    if (user) return user.uid;
    let localUid = localStorage.getItem('localUid');
    if (!localUid) {
      localUid = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('localUid', localUid);
    }
    return localUid;
  };

  const getUids = () => {
    const uids = [];
    if (user) uids.push(user.uid);
    const localUid = localStorage.getItem('localUid');
    if (localUid) uids.push(localUid);
    if (uids.length === 0) {
      const newLocal = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('localUid', newLocal);
      uids.push(newLocal);
    }
    return uids;
  };

  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    
    const saved = localStorage.getItem("aestudamos_flashcards");
    if (saved) {
      try {
        const parsedDecks = JSON.parse(saved);
        const decksWithIds = parsedDecks.map((deck: any, deckIndex: number) => ({
          ...deck,
          id: deck.id || `legacy-deck-${Date.now()}-${deckIndex}`,
          cards: deck.cards.map((card: any, cardIndex: number) => ({
            ...card,
            id: card.id || `legacy-card-${Date.now()}-${deckIndex}-${cardIndex}`
          }))
        }));
        setSavedDecks(decksWithIds);
        if (JSON.stringify(parsedDecks) !== JSON.stringify(decksWithIds)) {
          localStorage.setItem("aestudamos_flashcards", JSON.stringify(decksWithIds));
        }
      } catch (e) {
        console.error("Failed to parse saved decks", e);
      }
    }

    const isAdmin = user && (user.email === "henrique.rosa@poli.ufrj.br" || user.email === "brunool.rj@gmail.com");
    const uids = getUids();

    let q;
    if (isAdmin) {
      q = query(collection(db, "flashcardReviews"));
    } else {
      q = uids.length === 1
        ? query(collection(db, "flashcardReviews"), where("uid", "==", uids[0]))
        : query(collection(db, "flashcardReviews"), where("uid", "in", uids));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviews: FlashcardReview[] = [];
      snapshot.forEach((doc) => {
        reviews.push({ id: doc.id, ...doc.data() } as FlashcardReview);
      });
      setAllReviews(reviews);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "flashcardReviews");
    });

    return () => unsubscribe();
  }, [authReady, user]);

  // Periodic refresh for review lists to catch cards as they become ready
  useEffect(() => {
    const filterReviews = () => {
      const now = new Date();
      const ready = allReviews.filter(r => new Date(r.nextReviewDate) <= now);
      
      setReviewsEasy(ready.filter(r => r.status === 'easy'));
      setReviewsMedium(ready.filter(r => r.status === 'medium'));
      setReviewsHard(ready.filter(r => r.status === 'hard'));
    };

    filterReviews();
    const interval = setInterval(filterReviews, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [allReviews]);

  const handleStartStudy = () => {
    setDeckName("");
    setSources([]);
    setShowTopicInput(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newSources: ContentSource[] = Array.from(e.target.files).map(file => {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`O arquivo ${file.name} excede 10MB e foi ignorado.`);
          return null;
        }
        return { id: Math.random().toString(36).substring(2), type: 'file', file };
      }).filter(Boolean) as ContentSource[];
      
      setSources(prev => [...prev, ...newSources]);
      e.target.value = '';
    }
  };

  const addSource = (type: 'topic' | 'link') => {
    setSources(prev => [...prev, { id: Math.random().toString(36).substring(2), type, text: '', url: '' } as ContentSource]);
  };

  const updateSource = (id: string, value: string) => {
    setSources(prev => prev.map(s => {
      if (s.id === id) {
        if (s.type === 'topic') return { ...s, text: value };
        if (s.type === 'link') return { ...s, url: value };
      }
      return s;
    }));
  };

  const removeSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    setShowTopicInput(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerate = async () => {
    if (!deckName.trim()) {
      toast.error("Informe o nome do Deck (Disciplina, Professor, Data).");
      return;
    }
    
    const validSources = sources.filter(s => 
      (s.type === 'topic' && s.text.trim()) || 
      (s.type === 'link' && s.url.trim()) || 
      s.type === 'file'
    );

    if (validSources.length === 0) {
      toast.error("Adicione pelo menos uma fonte de conteúdo válida.");
      return;
    }

    setLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const parts: any[] = [];
      for (const source of validSources) {
        if (source.type === 'topic') {
          parts.push({ text: `Tópico: ${source.text}` });
        } else if (source.type === 'link') {
          parts.push({ text: `Link/Vídeo: ${source.url}` });
        } else if (source.type === 'file') {
          const base64 = await fileToBase64(source.file);
          parts.push({
            inlineData: {
              mimeType: source.file.type,
              data: base64
            }
          });
          parts.push({ text: `Arquivo anexado: ${source.file.name}` });
        }
      }

      const newCards = (await generateFlashcardsFromMultimodal(parts, deckName)).map((card: any, index: number) => ({
        ...card,
        id: `card-${Date.now()}-${index}`,
        difficulty: 'easy' // Default to easy so they don't show up in review queues initially
      }));
      
      if (abortControllerRef.current?.signal.aborted) return;

      const finalDeckName = deckName.trim() || `Flashcards - ${new Date().toLocaleDateString('pt-BR')}`;
      const newDeckId = Date.now().toString();
      const newDeck: FlashcardDeck = { id: newDeckId, name: finalDeckName, cards: newCards };
      
      setSavedDecks(prev => {
        const updatedDecks = [...prev, newDeck];
        localStorage.setItem("aestudamos_flashcards", JSON.stringify(updatedDecks));
        return updatedDecks;
      });

      setFlashcards(newCards);
      setTopic(finalDeckName);
      setCurrentDeckId(newDeckId);
      setCurrentIndex(0);
      setIsFlipped(false);
      setView('study');
      setShowTopicInput(false);
      toast.success(`Deck "${finalDeckName}" gerado e salvo na biblioteca!`);
    } catch (error: any) {
      if (abortControllerRef.current?.signal.aborted) {
        console.log("Geração cancelada pelo usuário.");
      } else {
        console.error("Erro ao gerar flashcards:", error);
        toast.error(`Erro ao gerar flashcards: ${error.message || "Verifique os dados e tente novamente."}`);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleFinishStudy = () => {
    setView('list');
    setTopic("");
    setCurrentDeckId(null);
    setFlashcards([]);
  };

  const currentCard = flashcards[currentIndex];

  const updateLocalDeckCardDifficulty = (deckId: string, cardId: string, newDifficulty: 'easy' | 'medium' | 'hard') => {
    setSavedDecks(prev => {
      const updatedDecks = prev.map(deck => {
        if (deck.id === deckId) {
          const updatedCards = deck.cards.map(card => {
            if (card.id === cardId) {
              return { ...card, difficulty: newDifficulty };
            }
            return card;
          });
          return { ...deck, cards: updatedCards };
        }
        return deck;
      });
      localStorage.setItem("aestudamos_flashcards", JSON.stringify(updatedDecks));
      return updatedDecks;
    });
  };

  const getNextReviewDate = (status: 'easy' | 'medium' | 'hard') => {
    const now = new Date();
    if (status === 'easy') {
      now.setDate(now.getDate() + 1); // 1 day
    } else if (status === 'medium') {
      now.setMinutes(now.getMinutes() + 30); // 30 mins
    } else if (status === 'hard') {
      now.setMinutes(now.getMinutes() + 10); // 10 mins
    }
    return now.toISOString();
  };

  const handleReview = async (status: 'easy' | 'medium' | 'hard') => {
    const uid = getUid();
    const nextDate = getNextReviewDate(status);

    try {
      if (view === 'review' && currentCard.id) {
        // We are reviewing an existing saved card from Firestore
        // Update status and next review date
        await updateDoc(doc(db, "flashcardReviews", currentCard.id), {
          status,
          nextReviewDate: nextDate
        });
        toast.success("Revisão agendada!");

        // Also update the local deck if we have the references
        if (currentCard.deckId && currentCard.cardId) {
          updateLocalDeckCardDifficulty(currentCard.deckId, currentCard.cardId, status);
        }

      } else {
        // We are studying a deck directly
        
        // Update the card's difficulty in the local deck
        if (currentDeckId && currentCard.id) {
          const updatedCards = [...flashcards];
          updatedCards[currentIndex] = { ...updatedCards[currentIndex], difficulty: status };
          setFlashcards(updatedCards);
          updateLocalDeckCardDifficulty(currentDeckId, currentCard.id, status);

          // Sync with Firestore review queue
          // First, check if this card is already in the review queue
          const allReviews = [...reviewsEasy, ...reviewsMedium, ...reviewsHard];
          const existingReview = allReviews.find(r => r.deckId === currentDeckId && r.cardId === currentCard.id);

          if (existingReview && existingReview.id) {
            await updateDoc(doc(db, "flashcardReviews", existingReview.id), {
              status,
              nextReviewDate: nextDate
            });
          } else {
            await addDoc(collection(db, "flashcardReviews"), {
              uid: uid,
              question: currentCard.question,
              answer: currentCard.answer,
              subject: currentCard.subject || topic,
              status,
              nextReviewDate: nextDate,
              createdAt: new Date().toISOString(),
              deckId: currentDeckId,
              cardId: currentCard.id
            });
          }
          toast.success("Salvo para revisão!");
        }
      }

      // Move to next card
      setIsFlipped(false);
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        if (view === 'review') {
          toast.success("Revisão concluída!");
          setView('list');
          setReviewMode(null);
        } else {
          toast.success("Você chegou ao fim do deck!");
        }
      }
    } catch (error) {
      console.error("Error saving review:", error);
      toast.error("Erro ao salvar revisão.");
    }
  };

  const startReview = (mode: 'easy' | 'medium' | 'hard') => {
    const cardsToReview = mode === 'easy' ? reviewsEasy : (mode === 'medium' ? reviewsMedium : reviewsHard);
    if (cardsToReview.length === 0) {
      toast.info("Nenhum card para revisar nesta categoria.");
      return;
    }
    
    // Map FlashcardReview to Flashcard format for the UI
    const mappedCards: Flashcard[] = cardsToReview.map(r => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      subject: r.subject,
      difficulty: r.status,
      deckId: r.deckId,
      cardId: r.cardId
    }));

    setFlashcards(mappedCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewMode(mode);
    setView('review');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl tracking-wide text-red-600" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Flashcards</h1>
          <p className="text-zinc-900 dark:text-white font-bold mt-2 text-2xl" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Memorização ativa com repetição espaçada.</p>
        </div>
        {view === 'list' ? (
          <div className="flex gap-2">
            <Button onClick={() => setView('metrics')} variant="outline" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Métricas
            </Button>
            <Button onClick={handleStartStudy} className="bg-indigo-600 hover:bg-indigo-700 dark:bg-zinc-900 dark:text-red-600 dark:hover:bg-zinc-800 dark:border dark:border-red-900/50 gap-2">
              <Layers className="w-4 h-4" />
              Estudar Agora
            </Button>
          </div>
        ) : (
          <Button onClick={() => setView('list')} variant="outline">
            Voltar para Lista
          </Button>
        )}
      </div>

      <AnimatePresence>
        {showTopicInput && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-3xl mx-auto"
          >
            <Card className="border-indigo-100 shadow-xl shadow-indigo-50 dark:bg-zinc-900 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-600 dark:text-red-600">
                  <BrainCircuit className="w-5 h-5" />
                  Gerar Novos Flashcards
                </CardTitle>
                <CardDescription className="dark:text-zinc-400">
                  Escolha como deseja gerar seus flashcards: por tópico, arquivo (PDF/Imagem) ou link de vídeo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="deckName" className="text-zinc-900 dark:text-white font-bold">Nome do Deck (Ex: Dir. Penal - Prof. Silva - 10/04)</Label>
                  <Input 
                    id="deckName"
                    placeholder="Identifique este conjunto de flashcards..." 
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    disabled={loading}
                    className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                  />
                </div>

                <div className="space-y-4">
                  <Label className="text-zinc-900 dark:text-white font-bold">Fontes de Conteúdo (Adicione várias)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => addSource('topic')} disabled={loading} className="border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <FileText className="w-4 h-4 mr-2"/> Texto / Tópico
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('file-upload')?.click()} disabled={loading} className="border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Upload className="w-4 h-4 mr-2"/> Arquivo (PDF/Img)
                    </Button>
                    <input id="file-upload" type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={handleFileChange} />
                    <Button variant="outline" size="sm" onClick={() => addSource('link')} disabled={loading} className="border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <LinkIcon className="w-4 h-4 mr-2"/> Link / Vídeo
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {sources.map(source => (
                      <div key={source.id} className="flex items-center gap-2 p-2 border rounded-md border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                        {source.type === 'topic' && (
                          <Input 
                            value={source.text} 
                            onChange={(e) => updateSource(source.id, e.target.value)} 
                            placeholder="Digite o texto ou tópico..." 
                            disabled={loading}
                            className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border-zinc-200 dark:border-zinc-700"
                          />
                        )}
                        {source.type === 'link' && (
                          <Input 
                            value={source.url} 
                            onChange={(e) => updateSource(source.id, e.target.value)} 
                            placeholder="Cole o link do YouTube ou site..." 
                            disabled={loading}
                            className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border-zinc-200 dark:border-zinc-700"
                          />
                        )}
                        {source.type === 'file' && (
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700">
                            {source.file.type.includes('pdf') ? <FileText className="w-4 h-4 text-red-500" /> : <ImageIcon className="w-4 h-4 text-blue-500" />}
                            <span className="text-sm truncate text-zinc-900 dark:text-white font-medium">{source.file.name}</span>
                          </div>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => removeSource(source.id)} disabled={loading} className="shrink-0 text-zinc-400 hover:text-red-500">
                          <X className="w-4 h-4"/>
                        </Button>
                      </div>
                    ))}
                    {sources.length === 0 && (
                      <div className="text-center p-4 border-2 border-dashed rounded-md text-zinc-500 border-zinc-200 dark:border-zinc-700 text-sm font-medium">
                        Nenhuma fonte adicionada. Adicione textos, arquivos ou links acima.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t dark:border-zinc-800">
                  <Button 
                    onClick={handleGenerate} 
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-red-600 dark:hover:bg-red-700 text-white"
                    disabled={loading || sources.length === 0 || !deckName.trim()}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Gerar 20 Flashcards</>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancel}
                    disabled={loading}
                    className="dark:border-zinc-700"
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'list' ? (
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-red-500" />
              Cards para Revisar Agora
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover:border-green-400 transition-colors cursor-pointer group bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/50" onClick={() => startReview('easy')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-green-700 dark:text-green-500 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Revisão Questões Fáceis
                    </div>
                    <Badge variant="secondary" className="bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200">
                      {reviewsEasy.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-green-600 dark:text-green-400/80">
                    Flashcards para revisão diária (1 dia).
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:border-yellow-400 transition-colors cursor-pointer group bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50" onClick={() => startReview('medium')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-yellow-700 dark:text-yellow-500 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Revisão Questões Médias
                    </div>
                    <Badge variant="secondary" className="bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">
                      {reviewsMedium.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400/80">
                    Revisão rápida (30 min).
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:border-red-400 transition-colors cursor-pointer group bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50" onClick={() => startReview('hard')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-red-700 dark:text-red-500 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Revisão Questões Difíceis
                    </div>
                    <Badge variant="secondary" className="bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200">
                      {reviewsHard.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-600 dark:text-red-400/80">
                    Revisão imediata (10 min).
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Save className="w-5 h-5 text-indigo-500" />
                Biblioteca de Cards
              </h2>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input 
                  placeholder="Buscar por tópico, nome..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 dark:bg-zinc-900 dark:border-zinc-800"
                />
              </div>
            </div>
            
            {savedDecks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedDecks
                  .filter(deck => 
                    deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    deck.cards.some(c => c.subject.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((deck) => {
                    const easyCount = deck.cards.filter(c => c.difficulty === 'easy').length;
                    const mediumCount = deck.cards.filter(c => c.difficulty === 'medium').length;
                    const hardCount = deck.cards.filter(c => c.difficulty === 'hard').length;
                    
                    return (
                      <Card key={deck.id} className="hover:border-indigo-200 transition-colors cursor-pointer group" onClick={() => {
                        setFlashcards(deck.cards);
                        setTopic(deck.name);
                        setCurrentDeckId(deck.id);
                        setCurrentIndex(0);
                        setIsFlipped(false);
                        setView('study');
                      }}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-bold text-zinc-700 group-hover:text-indigo-600 transition-colors">
                            {deck.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-col gap-2">
                            <p className="text-xs text-zinc-500 font-medium">{deck.cards.length} cards no total</p>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] px-1.5 py-0">
                                Fácil: {easyCount}
                              </Badge>
                              <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 text-[10px] px-1.5 py-0">
                                Médio: {mediumCount}
                              </Badge>
                              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[10px] px-1.5 py-0">
                                Difícil: {hardCount}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            ) : (
              <div className="text-center p-8 border-2 border-dashed rounded-lg border-zinc-200 dark:border-zinc-800">
                <p className="text-zinc-500 dark:text-zinc-400">Sua biblioteca está vazia. Gere novos flashcards para salvá-los aqui.</p>
              </div>
            )}
          </div>
        </div>
      ) : view === 'metrics' ? (
        <FlashcardMetrics reviews={allReviews} />
      ) : (
        <div className="max-w-xl mx-auto space-y-8">
          <div className="flex items-center justify-between text-sm text-zinc-500 px-2">
            <span>Card {currentIndex + 1} de {flashcards.length}</span>
            <div className="flex gap-1">
              {flashcards.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 w-4 rounded-full ${i === currentIndex ? 'bg-indigo-600' : 'bg-zinc-200'}`} 
                />
              ))}
            </div>
          </div>

          <div 
            className="perspective-1000 h-[400px] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div
              className="relative w-full h-full transition-all duration-500 preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              {/* Front */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center border-2 border-zinc-100 shadow-xl">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">Pergunta</span>
                <h2 className="text-2xl font-bold text-zinc-900">{currentCard?.question}</h2>
                <p className="mt-8 text-zinc-400 text-sm italic">Clique para ver a resposta</p>
              </Card>

              {/* Back */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center border-2 border-indigo-100 dark:border-indigo-900 shadow-xl bg-indigo-50/30 dark:bg-zinc-800 [transform:rotateY(180deg)]">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">Resposta</span>
                <div className="text-xl text-zinc-800 dark:text-white dark:font-bold leading-relaxed prose prose-indigo max-w-none">
                  <Markdown>{currentCard?.answer}</Markdown>
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="flex justify-center gap-4 min-h-[56px]">
            {isFlipped ? (
              <>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="rounded-full px-8 h-14 border-green-200 text-green-600 hover:bg-green-50 dark:bg-zinc-900 dark:border-green-900 dark:text-white dark:font-bold dark:hover:bg-green-900/50"
                  onClick={(e) => { e.stopPropagation(); handleReview('easy'); }}
                >
                  Fácil
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="rounded-full px-8 h-14 border-yellow-200 text-yellow-600 hover:bg-yellow-50 dark:bg-zinc-900 dark:border-yellow-900 dark:text-white dark:font-bold dark:hover:bg-yellow-900/50"
                  onClick={(e) => { e.stopPropagation(); handleReview('medium'); }}
                >
                  Média
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="rounded-full px-8 h-14 border-red-200 text-red-600 hover:bg-red-50 dark:bg-zinc-900 dark:border-red-900 dark:text-white dark:font-bold dark:hover:bg-red-900/50"
                  onClick={(e) => { e.stopPropagation(); handleReview('hard'); }}
                >
                  Difícil
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-full px-8 h-14 border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white dark:hover:bg-zinc-800"
                onClick={() => setIsFlipped(true)}
              >
                <RotateCcw className="w-5 h-5 mr-2" /> Mostrar Resposta
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex justify-between pt-4">
              <Button 
                variant="ghost" 
                disabled={currentIndex === 0}
                onClick={() => {
                  setIsFlipped(false);
                  setCurrentIndex(prev => prev - 1);
                }}
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
              </Button>
              <Button 
                variant="ghost"
                disabled={currentIndex === flashcards.length - 1}
                onClick={() => {
                  setIsFlipped(false);
                  setCurrentIndex(prev => prev + 1);
                }}
              >
                Próximo <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {view !== 'review' && (
              <Button 
                onClick={handleFinishStudy}
                className="w-full bg-green-600 hover:bg-green-700 font-bold text-white"
              >
                Concluir Estudo e Voltar para Biblioteca
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
