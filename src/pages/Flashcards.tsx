import { useState, useEffect } from "react";
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
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateFlashcards } from "@/lib/gemini";
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
  difficulty: 'easy' | 'medium' | 'hard';
}

interface FlashcardDeck {
  name: string;
  cards: Flashcard[];
}

interface FlashcardReview {
  id?: string;
  uid: string;
  question: string;
  answer: string;
  subject: string;
  status: 'medium' | 'hard';
  nextReviewDate: string;
  createdAt: string;
}

export default function Flashcards() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [view, setView] = useState<'list' | 'study' | 'review'>('list');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [savedDecks, setSavedDecks] = useState<FlashcardDeck[]>([]);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTopicInput, setShowTopicInput] = useState(false);
  
  const [reviewsMedium, setReviewsMedium] = useState<FlashcardReview[]>([]);
  const [reviewsHard, setReviewsHard] = useState<FlashcardReview[]>([]);
  const [reviewMode, setReviewMode] = useState<'medium' | 'hard' | null>(null);
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
      setSavedDecks(JSON.parse(saved));
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
      
      setReviewsMedium(reviews.filter(r => r.status === 'medium'));
      setReviewsHard(reviews.filter(r => r.status === 'hard'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "flashcardReviews");
    });

    return () => unsubscribe();
  }, [authReady, user]);

  const handleStartStudy = () => {
    setShowTopicInput(true);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Informe o tópico estudado hoje.");
      return;
    }
    setLoading(true);
    try {
      const newCards = await generateFlashcards(topic);
      setFlashcards(newCards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setView('study');
      setShowTopicInput(false);
      toast.success("20 Flashcards gerados com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar flashcards.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishStudy = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    const deckName = `Flashcard {${topic} - ${today}}`;
    
    const newDeck: FlashcardDeck = { name: deckName, cards: flashcards };
    const updatedDecks = [...savedDecks, newDeck];
    
    setSavedDecks(updatedDecks);
    localStorage.setItem("aestudamos_flashcards", JSON.stringify(updatedDecks));
    
    toast.success(`Estudo finalizado! Salvo como ${deckName}`);
    setView('list');
    setTopic("");
    setFlashcards([]);
  };

  const currentCard = flashcards[currentIndex];

  const handleReview = async (status: 'easy' | 'medium' | 'hard') => {
    const uid = getUid();

    try {
      if (view === 'review' && currentCard.id) {
        // We are reviewing an existing saved card
        if (status === 'easy') {
          await deleteDoc(doc(db, "flashcardReviews", currentCard.id));
          toast.success("Card removido da revisão!");
        } else {
          // Update status if it changed
          await updateDoc(doc(db, "flashcardReviews", currentCard.id), {
            status,
            nextReviewDate: new Date().toISOString() // Simplified logic
          });
          toast.success("Revisão agendada!");
        }
      } else {
        // We are studying a new deck
        if (status !== 'easy') {
          await addDoc(collection(db, "flashcardReviews"), {
            uid: uid,
            question: currentCard.question,
            answer: currentCard.answer,
            subject: currentCard.subject || topic,
            status,
            nextReviewDate: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
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

  const startReview = (mode: 'medium' | 'hard') => {
    const cardsToReview = mode === 'medium' ? reviewsMedium : reviewsHard;
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
      difficulty: r.status
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
          <Button onClick={handleStartStudy} className="bg-indigo-600 hover:bg-indigo-700 dark:bg-zinc-900 dark:text-red-600 dark:hover:bg-zinc-800 dark:border dark:border-red-900/50 gap-2">
            <Layers className="w-4 h-4" />
            Estudar Agora
          </Button>
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
            className="max-w-2xl mx-auto"
          >
            <Card className="border-indigo-100 shadow-xl shadow-indigo-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-600" />
                  O que você estudou hoje?
                </CardTitle>
                <CardDescription>
                  Informe o tópico para que possamos gerar 20 flashcards personalizados para sua revisão.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Tópico ou Matéria</Label>
                  <Input 
                    id="topic"
                    placeholder="Ex: Concordância Verbal, Leis de Newton, Revolução Francesa..." 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={handleGenerate} 
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    disabled={loading || !topic.trim()}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Gerar 20 Flashcards</>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowTopicInput(false)}
                    disabled={loading}
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Flashcards que você marcou como média dificuldade.
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
                  Flashcards que você marcou como alta dificuldade.
                </p>
              </CardContent>
            </Card>
          </div>

          {savedDecks.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Save className="w-5 h-5 text-indigo-500" />
                Seus Estudos Salvos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedDecks.map((deck, idx) => (
                  <Card key={idx} className="hover:border-indigo-200 transition-colors cursor-pointer group" onClick={() => {
                    setFlashcards(deck.cards);
                    setTopic(deck.name.replace("Flashcard {", "").split(" - ")[0]);
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
                      <p className="text-xs text-zinc-500">{deck.cards.length} cards para revisar</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Exemplos de Flashcards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
              {[
                { id: "1", question: "O que é Mitocôndria?", answer: "Organela responsável pela respiração celular e produção de ATP.", subject: "Biologia", difficulty: "easy" },
                { id: "2", question: "Fórmula da Segunda Lei de Newton", answer: "F = m * a (Força é igual a massa vezes aceleração).", subject: "Física", difficulty: "medium" },
                { id: "3", question: "Quem descobriu o Brasil?", answer: "Pedro Álvares Cabral em 1500.", subject: "História", difficulty: "easy" },
              ].map((card) => (
                <Card key={card.id} className="cursor-not-allowed">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary">{card.subject}</Badge>
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        {card.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium text-zinc-900">{card.question}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
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
                className="w-full bg-green-600 hover:bg-green-700 font-bold"
              >
                Finalizar Estudo e Salvar Deck
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
