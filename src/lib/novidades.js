/*
  Novidades por versão. A pessoa vê, ao entrar, tudo que saiu depois da última
  vez que abriu — mesmo que tenha ficado três atualizações sem aparecer.

  Como publicar uma novidade:
    1. acrescente um bloco NO TOPO da lista, com uma versão nova
    2. cada item pode ter `para: 'aluno'` ou `para: 'personal'`; sem isso, vale
       para os dois

  Quem nunca abriu o app não vê nada disso — ganha o tutorial de primeiro
  acesso, que já é bastante coisa de uma vez.
*/

export const NOVIDADES = [
  {
    versao: '2.6.0',
    data: '19 de outubro de 2026',
    titulo: 'Escolha o treino do dia e continue de onde parou',
    itens: [
      {
        para: 'aluno',
        texto: 'Agora você escolhe qual treino fazer hoje. Toque na letra (A, B, C…) e comece — não precisa seguir a ordem do ciclo se o dia não saiu como planejado.'
      },
      {
        para: 'aluno',
        texto: 'Saiu do app no meio do treino? Ao voltar, ele continua de onde você parou — inclusive em outro celular. O botão diz quantas séries faltam.'
      },
      {
        para: 'aluno',
        texto: 'As letras do ciclo mostram o que você fez de verdade: verde para treino concluído, meio preenchida para quem parou no meio. Antes elas ficavam verdes só por estarem na fila.'
      },
      {
        para: 'aluno',
        texto: 'O ciclo não trava mais. Mesmo que você feche o app sem tocar em "Finalizar", no dia seguinte o próximo treino já está certo.'
      },
      {
        para: 'aluno',
        texto: 'Sem sinal na academia? Pode marcar as séries normalmente: fica salvo no aparelho e sobe sozinho quando o sinal voltar.'
      },
      {
        para: 'aluno',
        texto: 'Os campos não dão mais zoom no iPhone ao tocar — principalmente o da carga, no meio do treino.'
      },
      {
        para: 'personal',
        texto: 'A ficha do aluno passa a contar como treino só o que foi treino de verdade: sessão concluída ou que passou da metade. Uma série solta não conta mais o dia inteiro.'
      },
      {
        para: 'personal',
        texto: '"Sem treinar há N dias" ficou confiável pelo mesmo motivo — antes bastava o aluno marcar uma série e parar para ele aparecer como ativo.'
      },
      {
        para: 'personal',
        texto: 'Seu aluno já pode escolher o treino do dia. Se preferir travar a ordem do ciclo, desmarque a opção no editor do plano.'
      },
      {
        para: 'personal',
        texto: 'A lista de conversas mostra a última mensagem, o horário e quantas faltam ler, ordenada pela conversa mais recente. Tem filtro de não lidas e de sem resposta.'
      }
    ]
  },
  {
    versao: '2.5.0',
    data: '13 de setembro de 2026',
    titulo: 'O app agora abre no Início',
    itens: [
      {
        para: 'aluno',
        texto: 'Ao entrar, você vê o que precisa de você hoje: o treino da vez, doses sem registro, check-in e mensagens novas — tudo numa tela só.'
      },
      {
        para: 'aluno',
        texto: '"Meu Treino" virou "Treino" e continua onde estava, com tudo igual. Ele deixou de ser a primeira tela, mas está a um toque no menu.'
      },
      {
        para: 'aluno',
        texto: 'A tela muda conforme o seu dia: treino por começar, em andamento, concluído ou dia de descanso — e some o que não tem nada para mostrar.'
      },
      {
        para: 'aluno',
        texto: 'No computador, as teclas de 1 a 7 trocam de tela. Só navegam: nenhuma registra dose nem conclui série.'
      }
    ]
  },
  {
    versao: '2.4.0',
    data: '13 de setembro de 2026',
    titulo: 'Esquecer de registrar não é mais "não tomei"',
    itens: [
      {
        para: 'aluno',
        texto: 'Dia sem registro agora aparece como "? não registrado", e não mais como "× não tomou". São coisas diferentes, e o app parou de concluir por você.'
      },
      {
        para: 'aluno',
        texto: 'Toque em qualquer dia do histórico para ver o que estava previsto e informar o que aconteceu — inclusive em dias passados. A consistência se refaz na hora.'
      },
      {
        para: 'aluno',
        texto: 'Ao registrar, você escolhe: tomei, tomei parcialmente ou não tomei. Um toque na bolinha continua sendo o caminho curto para "tomei".'
      },
      {
        para: 'aluno',
        texto: 'A consistência passou a mostrar de onde vem o número: quantas tomadas, quantas parciais, quantas não tomadas e quantas ficaram sem registro. As sem registro não entram na conta.'
      },
      {
        para: 'aluno',
        texto: 'Quem responde "não tomei" para de receber lembrete daquela dose. Você já respondeu.'
      },
      {
        para: 'personal',
        texto: 'A aderência do aluno agora separa o que ele não tomou do que ele não informou — o número ficou mais justo com quem treina e esquece de anotar.'
      }
    ]
  },
  {
    versao: '2.3.0',
    data: '8 de setembro de 2026',
    titulo: 'Lembrete de suplementação no celular',
    itens: [
      {
        para: 'aluno',
        texto: 'Agora o CoachApp avisa na hora da dose, mesmo com o app fechado. Ative em Suplementação e escolha o horário de cada dose.'
      },
      {
        para: 'aluno',
        texto: 'Tocando no aviso, o app abre direto no suplemento — é só marcar a dose.'
      },
      {
        para: 'aluno',
        texto: 'Se você não registrar, o app pergunta uma vez, uma hora depois. Só isso: sem resposta, a dose fica como não registrada, nunca como não tomada.'
      },
      {
        para: 'aluno',
        texto: 'Dá para silenciar por hoje ou desligar todos os lembretes de uma vez, sem mexer nos seus suplementos.'
      },
      {
        para: 'aluno',
        texto: 'No iPhone, os lembretes só funcionam com o CoachApp adicionado à tela de início — o app explica como fazer.'
      }
    ]
  },
  {
    versao: '2.2.0',
    data: '7 de setembro de 2026',
    titulo: 'Pagamentos mais claros',
    itens: [
      {
        para: 'aluno',
        texto: 'A tela de Pagamentos mostra a mensalidade da vez em destaque, com a chave PIX e um botão para copiar. As mensalidades futuras ficam só como aviso, sem botão.'
      },
      {
        para: 'aluno',
        texto: 'O botão agora é "Já paguei": você paga pelo banco e avisa aqui. A confirmação abre na hora, com o valor e o mês, e você pode anexar o comprovante.'
      },
      {
        para: 'aluno',
        texto: 'Se o personal não confirmar o pagamento, você vê o motivo e pode informar de novo.'
      },
      {
        para: 'personal',
        texto: 'Os pagamentos informados aparecem no topo do Financeiro, com a data, a observação e o comprovante do aluno.'
      },
      {
        para: 'personal',
        texto: 'Ao recusar um pagamento, você pode escrever o motivo — o aluno lê e corrige.'
      }
    ]
  },
  {
    versao: '2.1.0',
    data: '20 de agosto de 2026',
    titulo: 'Treino mais fácil de acompanhar',
    itens: [
      {
        para: 'aluno',
        texto: 'Marque as séries direto na lista, sem entrar em outra tela. Toque no exercício e ele abre com as séries, a carga e o vídeo.'
      },
      {
        para: 'aluno',
        texto: 'O vídeo de demonstração agora abre dentro do app, no botão "Como executar".'
      },
      {
        para: 'aluno',
        texto: 'Conte como foi o exercício no botão "Feedback" — se a carga pesou ou se sentiu dor, seu personal recebe na hora.'
      },
      {
        para: 'aluno',
        texto: 'Toque nas letras A, B, C para ver qualquer treino do seu plano e baixar em PDF.'
      },
      {
        para: 'aluno',
        texto: 'O cronômetro de descanso voltou, e agora dá para desligar em Configurações.'
      },
      {
        para: 'personal',
        texto: 'Nova aba Feedback na ficha do aluno: o que ele respondeu em cada exercício, com destaque no que precisa de ajuste.'
      },
      {
        para: 'personal',
        texto: 'Ao digitar um exercício no template, aparecem os que você já usou antes — e ainda dá para escrever um novo.'
      },
      {
        texto: 'Tutorial de primeiro acesso em cada tela. Para rever, use o "?" no topo.'
      }
    ]
  }
]

export const VERSAO_ATUAL = NOVIDADES[0]?.versao || '1.0.0'

/**
 * Blocos publicados depois da versão que a pessoa já viu.
 * `vista` ausente = conta nova; devolve vazio para não atropelar o tutorial.
 */
export function novidadesDesde(vista, papel) {
  if (!vista) return []

  const ate = NOVIDADES.findIndex(n => n.versao === vista)
  const novos = ate === -1 ? NOVIDADES : NOVIDADES.slice(0, ate)

  return novos
    .map(bloco => ({
      ...bloco,
      itens: bloco.itens.filter(i => !i.para || i.para === papel)
    }))
    .filter(bloco => bloco.itens.length > 0)
}
