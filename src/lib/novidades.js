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
