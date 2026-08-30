/*
  Textos dos tutoriais de primeiro acesso, uma lista por tela.

  Cada passo é `{ alvo, titulo, texto }`. `alvo` é um seletor CSS; se o elemento
  não estiver na tela naquele momento, o passo é pulado sozinho (ver Tour.jsx).
  Passo sem `alvo` aparece centralizado — bom para abrir e fechar o tour.

  Para acrescentar explicação a um campo novo, basta somar um item aqui.
*/

/* ========================= ALUNO ========================= */

export const TOUR_ALUNO_TREINO = [
  {
    titulo: 'Bem-vindo ao CoachApp',
    texto: 'Vou levar 1 minuto mostrando como usar. Você pode pular a qualquer hora e rever depois pelo "?" no topo.'
  },
  {
    alvo: '.tr-hero',
    titulo: 'Seu treino de hoje',
    texto: 'Este bloco mostra qual treino é o da vez e quanto dele você já fez.'
  },
  {
    alvo: '.tr-ciclo',
    titulo: 'Os treinos do seu plano',
    texto: 'A, B, C são os treinos que se alternam. O escuro é o de hoje. Toque em qualquer letra para espiar o treino inteiro — e baixar em PDF, se quiser levar impresso.'
  },
  {
    alvo: '.tr-progresso',
    titulo: 'Quanto falta',
    texto: 'As séries que você marcou, do total do dia. A barra e o tempo estimado vão diminuindo conforme você treina.'
  },
  {
    alvo: '.tr-retomada',
    titulo: 'Onde você parou',
    texto: 'Se você fechar o app no meio do treino, é aqui que ele lembra em qual exercício estava.'
  },
  {
    alvo: '.tr-lista .tr-ex',
    titulo: 'Seus exercícios',
    texto: 'Toque em qualquer exercício para abrir. O que está com a borda vermelha é o da vez; os terminados ficam com um visto verde.'
  },
  {
    alvo: '.tr-ex.aberto .tr-series',
    titulo: 'Marque cada série',
    texto: 'Cada quadrado é uma série, com as repetições e a carga que o personal montou. Toque quando terminar — ele fica verde e não dá para desmarcar.'
  },
  {
    alvo: '.tr-ex.aberto .tr-ex-carga',
    titulo: 'A carga que você usou',
    texto: 'Se pegou um peso diferente do combinado, escreva aqui antes de marcar a série. Em branco, vale a carga do plano. Menos que o combinado o app não aceita — fale com seu personal.'
  },
  {
    alvo: '.tr-ex.aberto .tr-video',
    titulo: 'Na dúvida, veja o vídeo',
    texto: 'Quando o personal deixou uma demonstração, ela abre aqui dentro, sem sair do app.'
  },
  {
    alvo: '.tr-ex.aberto .tr-fb',
    titulo: 'Conte como foi',
    texto: 'Carga pesada demais? Sentiu dor? Responda aqui que seu personal recebe na hora e ajusta o treino.'
  },
  {
    alvo: '.tr-avisos',
    titulo: 'Avisos rápidos',
    texto: 'Sua sequência de dias treinados e a próxima mensalidade. Toque na cobrança para ir direto aos pagamentos.'
  },
  {
    alvo: '.sidebar-nav',
    titulo: 'O resto do app',
    texto: 'Evolução tem seus gráficos e medidas. Check-in é seu espaço privado. Em Chat você fala com o personal, e em Configurações dá para desligar o cronômetro de descanso.'
  }
]

export const TOUR_ALUNO_EVOLUCAO = [
  {
    alvo: '.metricas-aluno',
    titulo: 'Seus números',
    texto: 'Dias seguidos, treinos no mês e o total acumulado desde que você começou.'
  },
  {
    alvo: '.heatmap, .card',
    titulo: 'Calendário',
    texto: 'Cada quadradinho é um dia. Quanto mais escuro, mais séries você fez naquele dia.'
  }
]

export const TOUR_ALUNO_DIARIO = [
  {
    titulo: 'Este espaço é só seu',
    texto: 'O que você escrever aqui é privado. Seu personal só vê o que você marcar como compartilhado, um registro por vez.'
  }
]

export const TOUR_ALUNO_PAGAMENTOS = [
  {
    alvo: '.codigo-box',
    titulo: 'Chave PIX do personal',
    texto: 'Pague pelo seu banco usando esta chave.'
  },
  {
    alvo: '.cobranca-item',
    titulo: 'Avise depois de pagar',
    texto: 'Toque em "Registrar pagamento" para o personal validar. Enquanto ele não confirma, fica como "em análise".'
  }
]

/* ========================= PERSONAL ========================= */

export const TOUR_PERSONAL_INICIO = [
  {
    titulo: 'Bem-vindo ao CoachApp',
    texto: 'Um minuto para mostrar onde fica cada coisa. Dá para pular e rever depois pelo "?" no topo.'
  },
  {
    alvo: '.stats-grid',
    titulo: 'Seu resumo',
    texto: 'Alunos ativos, quem treinou hoje e quanto tem a receber. Atualiza sozinho.'
  },
  {
    alvo: '.sidebar-nav',
    titulo: 'Suas telas',
    texto: 'Alunos é sua carteira. Templates são planos prontos para reaproveitar. Financeiro controla as mensalidades.'
  }
]

export const TOUR_PERSONAL_ALUNOS = [
  {
    alvo: '.barra-filtros',
    titulo: 'Encontre um aluno',
    texto: 'Busque por nome ou código, e filtre por ativos, sem plano ou em atraso.'
  },
  {
    alvo: '.card',
    titulo: 'Cadastrar aluno',
    texto: 'Você pode preencher os dados aqui, ou mandar o link da ficha para o próprio aluno preencher. O CPF é o que impede cadastro duplicado.'
  },
  {
    alvo: '.tabela-alunos, .lista-alunos',
    titulo: 'Sua carteira',
    texto: 'Em Perfil você vê avaliações, fotos, check-ins e os feedbacks dos exercícios. Em Treino você monta ou ajusta o plano dele.'
  }
]

export const TOUR_PERSONAL_TEMPLATES = [
  {
    titulo: 'Planos prontos',
    texto: 'Um template guarda o plano inteiro — treinos A, B, C e todos os exercícios. Ao aplicar em um aluno, tudo entra de uma vez.'
  },
  {
    alvo: '.dias-tabs',
    titulo: 'Os treinos do plano',
    texto: 'Cada aba é um treino do ciclo. O aluno vai passando de um para o outro conforme conclui.'
  },
  {
    alvo: '.ex-nome-input',
    titulo: 'Digite o exercício',
    texto: 'Enquanto digita, aparecem os que você já usou antes. Pode escolher da lista ou escrever um novo.'
  },
  {
    alvo: '.linhas-serie',
    titulo: 'Uma linha por série',
    texto: 'Use várias linhas para progressão de carga: 20 reps com 30kg, depois 15 com 40kg, e assim por diante. O aluno vê exatamente isso.'
  },
  {
    alvo: '.barra-selecao, .ex-check',
    titulo: 'Bi-set',
    texto: 'Marque dois exercícios e clique em Combinar para o aluno alterná-los sem descanso.'
  }
]

export const TOUR_PERSONAL_FINANCEIRO = [
  {
    titulo: 'Mensalidades',
    texto: 'Crie a cobrança, o aluno paga e registra. Você confere e valida — só então ela entra como paga.'
  }
]
