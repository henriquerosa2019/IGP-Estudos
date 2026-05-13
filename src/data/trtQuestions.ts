import { Questao, Flashcard } from "../types";

export const trtQuestoes: Questao[] = [
  {
    id: 1,
    disciplina: "Língua Portuguesa",
    assunto: "Acentuação Gráfica",
    concurso: "TRT",
    banca: "Esquadrão de Elite",
    ano: 2025,
    nivel: "medio",
    tipo: "multipla_escolha",
    enunciado:
      "A acentuação gráfica é essencial para a correta escrita das palavras na língua portuguesa, pois marca a tonicidade e pode até mesmo diferenciar significados. Observe as sequências de palavras a seguir e identifique aquela em que TODAS as palavras estão grafadas corretamente quanto à acentuação, obedecendo às normas ortográficas vigentes. Lembre-se de que as regras de acentuação abrangem proparoxítonas, paroxítonas e oxítonas, cada uma com seus critérios específicos.",
    alternativas: [
      {
        letra: "A",
        texto: "saudáde, próximo, maíz, heroísmo, paciência",
        correta: false,
        analise:
          "Contém erros: 'saudáde' não existe (correto é 'saúde'); 'maíz' em português é 'milho'. Alternativa incorreta.",
      },
      {
        letra: "B",
        texto: "caridade, próximo, milho, heroísmo, paciência",
        correta: false,
        analise:
          "Apresenta 'próximo' (masculino) em vez de 'próxima' (feminino). A concordância exigiria 'próxima' no contexto.",
      },
      {
        letra: "C",
        texto: "saudáde, próxima, maíz, heróismo, paciência",
        correta: false,
        analise:
          "Contém 'saudáde' (inexistente), 'maíz' (incorreto em português) e 'heróismo' (grafia errada; correto é 'heroísmo').",
      },
      {
        letra: "D",
        texto: "caridade, próxima, milho, heroísmo, paciência",
        correta: true,
        analise:
          "CORRETA — Todas corretas: 'caridade' (paroxítona em -dade), 'próxima' (paroxítona em -ima), 'milho' (paroxítona em -lho, SEM acento), 'heroísmo' (paroxítona em -ismo) e 'paciência' (paroxítona em -ência).",
      },
      {
        letra: "E",
        texto: "caridade, próximo, milho, heroísmo, paciência",
        correta: false,
        analise:
          "Embora quase correta, usa 'próximo' (masculino) em vez de 'próxima', tornando a alternativa inconsistente.",
      },
    ],
    gabarito: "D",
    comentario:
      "Palavras paroxítonas terminadas em -dade (caridade), -ima (próxima), -ismo (heroísmo) e -ência (paciência) levam acento. Milho é paroxítona terminada em -lho e NÃO recebe acento. O pulo do gato está em perceber que 'próxima' (feminino) deve ser acentuado assim como 'próximo', mantendo a regra paroxítona.",
    tags: ["acentuação", "paroxítona", "oxítona", "proparoxítona", "ortografia"],
  },
  {
    id: 2,
    disciplina: "Língua Portuguesa",
    assunto: "Ortografia",
    concurso: "TRT",
    banca: "Esquadrão de Elite",
    ano: 2025,
    nivel: "medio",
    tipo: "multipla_escolha",
    enunciado:
      "A ortografia das palavras deve respeitar as convenções estabelecidas pelo sistema de escrita do português brasileiro. Considere as palavras apresentadas nos itens a seguir e assinale a opção que contém APENAS palavras grafadas de acordo com a norma ortográfica vigente. Preste atenção às regras específicas de cada termo, incluindo a presença ou ausência de acento gráfico e a correta distribuição de consoantes e vogais.",
    alternativas: [
      {
        letra: "A",
        texto: "recepção, exceção, excesso, concepção, discrição",
        correta: true,
        analise:
          "CORRETA — Todas corretas: 'recepção', 'exceção', 'concepção' e 'discrição' são paroxítonas em -ção (com acento). 'Excesso' é paroxítona em -so (sem acento, com -ss-).",
      },
      {
        letra: "B",
        texto: "recepção, exceção, excessão, concepção, discrição",
        correta: false,
        analise:
          "'Excessão' não existe na língua portuguesa. O termo correto é 'excesso'. Este único erro desqualifica toda a alternativa.",
      },
      {
        letra: "C",
        texto: "recepção, exceção, excesso, conceção, discretção",
        correta: false,
        analise:
          "'Conceção' é forma portuguesa de Portugal (no Brasil é 'concepção') e 'discretção' é forma inexistente (correto: 'discrição'). Dois erros.",
      },
      {
        letra: "D",
        texto: "receção, excessão, excesso, concepção, discrição",
        correta: false,
        analise:
          "'Receção' é forma de Portugal (no Brasil é 'recepção') e 'excessão' não existe. Dois erros graves.",
      },
      {
        letra: "E",
        texto: "recepção, excepção, excesso, concepção, discretção",
        correta: false,
        analise:
          "'Excepção' (com 'p') é forma de Portugal e 'discretção' é inexistente (correto: 'discrição'). Dois erros.",
      },
    ],
    gabarito: "A",
    comentario:
      "Grave isso: em português brasileiro não existe 'excessão'. O termo correto é 'excesso' (substantivo com duplo 's'). 'Recepção', 'exceção', 'concepção' e 'discrição' seguem a regra das palavras terminadas em -ção. Note que 'discretção' e 'conceção' são grafias incorretas no Brasil.",
    tags: ["ortografia", "grafia", "norma culta", "português brasileiro"],
  },
  {
    id: 3,
    disciplina: "Língua Portuguesa",
    assunto: "Concordância Verbal e Nominal",
    concurso: "TRT",
    banca: "Esquadrão de Elite",
    ano: 2025,
    nivel: "medio",
    tipo: "certo_errado",
    enunciado:
      "Em relação às regras de concordância verbal e nominal da língua portuguesa, julgue o item a seguir: 'Fazem dois anos que não me vejo com ela.' — A frase está correta, pois o verbo 'fazer' indicando tempo decorrido é impessoal e deve concordar com o sujeito da oração.",
    alternativas: [
      {
        letra: "C",
        texto: "CERTO",
        correta: false,
        analise:
          "INCORRETA — O verbo 'fazer' indicando tempo decorrido é IMPESSOAL, portanto deve ficar no singular: 'Faz dois anos que não me vejo com ela.'",
      },
      {
        letra: "E",
        texto: "ERRADO",
        correta: true,
        analise:
          "CORRETA — O verbo 'fazer' é impessoal quando indica tempo. Deve ficar no singular: 'Faz dois anos'. Pluralizar esse verbo é erro clássico de concordância.",
      },
    ],
    gabarito: "E",
    comentario:
      "O verbo 'fazer' quando indica tempo decorrido é IMPESSOAL — não tem sujeito e fica sempre no singular. 'Faz dois anos', 'faz três meses', 'faz uma semana'. Erro clássico em provas de concurso!",
    tags: ["concordância verbal", "verbo impessoal", "fazer", "tempo decorrido"],
  },
];

export const trtFlashcards: Flashcard[] = [
  {
    id: 1,
    disciplina: "Língua Portuguesa",
    assunto: "Acentuação Gráfica",
    frente: "Palavras paroxítonas terminadas em -LHO recebem acento?",
    verso: "NÃO! Paroxítonas terminadas em -lho NÃO recebem acento gráfico.\nExemplo: milho, filho, galho, rolha.",
    tags: ["acentuação", "paroxítona"],
    nivel: "facil",
  },
  {
    id: 2,
    disciplina: "Língua Portuguesa",
    assunto: "Acentuação Gráfica",
    frente: "Cite 4 terminações de paroxítonas que RECEBEM acento obrigatório.",
    verso: "-dade (caridade)\n-ima (próxima)\n-ismo (heroísmo)\n-ência (paciência)\n\nDica: sempre que a terminação 'foge' do padrão -a/-e/-o, recebe acento!",
    tags: ["acentuação", "paroxítona"],
    nivel: "medio",
  },
  {
    id: 3,
    disciplina: "Língua Portuguesa",
    assunto: "Ortografia",
    frente: "Existe a palavra 'excessão' em português brasileiro?",
    verso: "NÃO! 'Excessão' não existe.\nO correto é 'excesso' (substantivo com -ss-, sem acento).\nExceção = ato de excetuar (paroxítona em -ção, com acento).",
    tags: ["ortografia", "grafia"],
    nivel: "facil",
  },
  {
    id: 4,
    disciplina: "Língua Portuguesa",
    assunto: "Ortografia",
    frente: "Qual a diferença entre 'discrição' e 'descrição'?",
    verso: "Discrição = qualidade de quem é discreto, reservado.\n'Ela agiu com discrição.'\n\nDescrição = ato de descrever.\n'A descrição do crime foi detalhada.'",
    tags: ["ortografia", "parônimos"],
    nivel: "medio",
  },
  {
    id: 5,
    disciplina: "Língua Portuguesa",
    assunto: "Concordância Verbal",
    frente: "O verbo FAZER indicando tempo decorrido vai para o plural?",
    verso: "NÃO! O verbo 'fazer' indicando tempo é IMPESSOAL — sempre singular.\n\n✓ Faz dois anos que não o vejo.\n✗ Fazem dois anos que não o vejo.\n\nMesma regra: Há dois anos / Havia dois anos.",
    tags: ["concordância verbal", "verbo impessoal"],
    nivel: "medio",
  },
  {
    id: 6,
    disciplina: "Língua Portuguesa",
    assunto: "Acentuação Gráfica",
    frente: "Como identificar uma palavra PROPAROXÍTONA?",
    verso: "Proparoxítona: sílaba tônica é a ANTEpenúltima.\nTODAS as proparoxítonas são acentuadas!\n\nExemplos: lâmpada, mágica, frágil, médico, público, tráfico.",
    tags: ["acentuação", "proparoxítona"],
    nivel: "facil",
  },
];
