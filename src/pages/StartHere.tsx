import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, FileText, LayoutDashboard, MessageSquare } from "lucide-react";

export default function StartHere() {
  return (
    <div className="space-y-8 text-zinc-900 dark:text-zinc-50 max-w-4xl mx-auto">
      <div>
        <h1 className="text-5xl tracking-wide text-red-600" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Comece Aqui</h1>
        <p className="text-zinc-900 dark:text-white font-bold mt-2 text-2xl" style={{ fontFamily: "'Deutsch Gothic', serif" }}>
          Siga este passo a passo para aproveitar ao máximo a plataforma Kverna Concurso 2.0.
        </p>
      </div>

      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-300 dark:before:via-zinc-700 before:to-transparent">
        
        {/* Passo 1 */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-zinc-100 dark:bg-zinc-900 text-red-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            <FileText className="w-5 h-5" />
          </div>
          <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:border-red-500/50 transition-colors bg-white dark:bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-red-600 font-bold">1. Cadastre seus Editais</CardTitle>
            </CardHeader>
            <CardContent className="text-black font-bold">
              <p>Vá até a aba <strong>Editais</strong> e importe o edital de seu(s) concurso(s) via PDF ou via link. A plataforma analisará o documento e extrairá todas as matérias e tópicos necessários para a sua aprovação.</p>
            </CardContent>
          </Card>
        </div>

        {/* Passo 2 */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-zinc-100 dark:bg-zinc-900 text-red-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            <Calendar className="w-5 h-5" />
          </div>
          <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:border-red-500/50 transition-colors bg-white dark:bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-red-600 font-bold">2. Gere seu Plano de Estudos</CardTitle>
            </CardHeader>
            <CardContent className="text-black font-bold">
              <p>Na aba <strong>Plano de Estudos</strong>, selecione seu(s) edital(is) em <strong>Análise de Editais</strong> e defina sua disponibilidade. O sistema criará um cronograma inteligente cruzando as matérias comuns e otimizando seu tempo.</p>
            </CardContent>
          </Card>
        </div>

        {/* Passo 3 */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-zinc-100 dark:bg-zinc-900 text-red-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:border-red-500/50 transition-colors bg-white dark:bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-red-600 font-bold">3. Acompanhe seu Progresso</CardTitle>
            </CardHeader>
            <CardContent className="text-black font-bold">
              <p>Conforme você estuda e marca os tópicos como concluídos, o <strong>Dashboard</strong> é atualizado automaticamente. Acompanhe sua ofensiva, horas de estudo e precisão para manter a motivação.</p>
            </CardContent>
          </Card>
        </div>

        {/* Passo 4 */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-zinc-100 dark:bg-zinc-900 text-red-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            <BookOpen className="w-5 h-5" />
          </div>
          <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:border-red-500/50 transition-colors bg-white dark:bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-red-600 font-bold">4. Revise com Flashcards</CardTitle>
            </CardHeader>
            <CardContent className="text-black font-bold">
              <p>Acesse a aba <strong>Flashcards</strong> para gerar cards de revisão baseados no que você estudou. Utilize a repetição espaçada para memorizar o conteúdo de forma eficiente.</p>
            </CardContent>
          </Card>
        </div>

        {/* Passo 5 */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-zinc-100 dark:bg-zinc-900 text-red-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            <MessageSquare className="w-5 h-5" />
          </div>
          <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:border-red-500/50 transition-colors bg-white dark:bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-red-600 font-bold">5. Tire Dúvidas com o KvernAI</CardTitle>
            </CardHeader>
            <CardContent className="text-black font-bold">
              <p>Surgiu alguma dúvida durante o estudo? O <strong>KvernAI</strong> é o seu tutor particular. Ele está pronto para explicar conceitos complexos e ajudar na resolução de questões.</p>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
