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
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateFlashcards } from "@/lib/gemini";
import { toast } from "sonner";
import Markdown from "react-markdown";

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

export default function Flashcards() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [view, setView] = useState<'list' | 'study'>('list');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [savedDecks, setSavedDecks] = useState<FlashcardDeck[]>([]);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTopicInput, setShowTopicInput] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("aestudamos_flashcards");
    if (saved) {
      setSavedDecks(JSON.parse(saved));
    }
  }, []);

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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Flashcards</h1>
          <p className="text-zinc-500 mt-2">Memorização ativa com repetição espaçada.</p>
        </div>
        {view === 'list' ? (
          <Button onClick={handleStartStudy} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
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
          {savedDecks.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
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
            <h2 className="text-xl font-bold text-zinc-800">Exemplos de Flashcards</h2>
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
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center border-2 border-indigo-100 shadow-xl bg-indigo-50/30 [transform:rotateY(180deg)]">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">Resposta</span>
                <div className="text-xl text-zinc-800 leading-relaxed prose prose-indigo max-w-none">
                  <Markdown>{currentCard?.answer}</Markdown>
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="flex justify-center gap-4">
            <Button 
              variant="outline" 
              size="lg" 
              className="rounded-full w-14 h-14 p-0 border-red-200 text-red-500 hover:bg-red-50"
              onClick={() => {
                setIsFlipped(false);
                setCurrentIndex((prev) => (prev + 1) % flashcards.length);
              }}
            >
              <X className="w-6 h-6" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="rounded-full w-14 h-14 p-0 border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <RotateCcw className="w-6 h-6" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="rounded-full w-14 h-14 p-0 border-green-200 text-green-500 hover:bg-green-50"
              onClick={() => {
                setIsFlipped(false);
                setCurrentIndex((prev) => (prev + 1) % flashcards.length);
              }}
            >
              <Check className="w-6 h-6" />
            </Button>
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

            <Button 
              onClick={handleFinishStudy}
              className="w-full bg-green-600 hover:bg-green-700 font-bold"
            >
              Finalizar Estudo e Salvar Deck
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
