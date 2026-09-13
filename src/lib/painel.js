/*
  O que a Home do aluno mostra, e em que ordem.

  Fica fora do React de propósito: a decisão de "o que importa agora" é a parte
  mais fácil de errar e a mais difícil de conferir no olho — são dezenas de
  combinações de treino, dose, check-in, mensagem e cobrança. Aqui dá para
  testar todas sem abrir navegador.

  A tela não decide nada: ela desenha o que esta função devolve.

  PRINCÍPIO
    Início = contexto + prioridade + ação. O aluno abre o app para descobrir o
    que precisa fazer agora, não para navegar. Então há UM foco por vez, e o
    resto vira uma lista curta — não um card para cada assunto.
*/

/* ---------------- saudação ---------------- */

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function saudacao(nome, agora = new Date()) {
  const h = agora.getHours()
  const parte = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiro = String(nome || '').trim().split(' ')[0] || ''
  return {
    texto: primeiro ? `${parte}, ${primeiro}` : parte,
    data: `${DIAS[agora.getDay()]}, ${agora.getDate()} de ${MESES[agora.getMonth()]}`
  }
}

/* ---------------- o foco ---------------- */

/**
 * O bloco grande do topo: a única coisa que a pessoa precisa olhar primeiro.
 *
 * A ordem não é estética. Inadimplência vem antes do treino porque o treino
 * está bloqueado — oferecer "Começar treino" para quem vai bater numa parede
 * seria pior do que não oferecer nada.
 */
export function montarFoco({
  bloqueado, temPlano, seriesDoDia, seriesFeitas, minutosRestantes,
  nomeTreino, resumoTreino, proximoTreino, ehDescanso, exerciciosDoDia
}) {
  if (bloqueado) {
    return {
      tipo: 'bloqueado',
      titulo: 'Treino bloqueado',
      subtitulo: 'Há uma mensalidade vencida. Regularize para liberar.',
      acao: { rotulo: 'Ver pagamentos', aba: 'pagamentos' }
    }
  }

  if (!temPlano) {
    return {
      tipo: 'sem_plano',
      titulo: 'Nenhum treino montado ainda',
      subtitulo: 'Seu personal ainda não publicou seu plano. Assim que publicar, aparece aqui.',
      acao: null
    }
  }

  if (ehDescanso) {
    return {
      tipo: 'descanso',
      titulo: 'Dia de descanso',
      subtitulo: proximoTreino ? `Seu próximo treino é ${proximoTreino}.` : 'Nada previsto para hoje.',
      acao: proximoTreino ? { rotulo: 'Ver próximo treino', aba: 'treino' } : null
    }
  }

  const completo = seriesDoDia > 0 && seriesFeitas >= seriesDoDia
  if (completo) {
    return {
      tipo: 'treino_concluido',
      titulo: `${nomeTreino} concluído`,
      subtitulo: `${seriesDoDia} ${seriesDoDia === 1 ? 'série registrada' : 'séries registradas'}.`,
      acao: { rotulo: 'Ver evolução', aba: 'evolucao' },
      progresso: 100
    }
  }

  if (seriesFeitas > 0) {
    return {
      tipo: 'treino_andamento',
      titulo: `${nomeTreino} em andamento`,
      subtitulo: `${seriesFeitas} de ${seriesDoDia} séries · faltam cerca de ${minutosRestantes} min`,
      acao: { rotulo: 'Continuar treino', aba: 'treino' },
      progresso: Math.round((seriesFeitas / seriesDoDia) * 100)
    }
  }

  return {
    tipo: 'treino',
    titulo: nomeTreino || 'Treino de hoje',
    subtitulo: resumoTreino,
    exercicios: exerciciosDoDia || [],
    acao: { rotulo: 'Começar treino', aba: 'treino' },
    progresso: 0
  }
}

/* ---------------- o que pede ação ---------------- */

/**
 * A lista curta do "precisa de você".
 *
 * Uma linha por pendência, não um card — quatro cards de assuntos diferentes
 * empurram tudo que interessa para baixo da dobra, e a Home vira rolagem.
 * Item que não existe não ocupa espaço nenhum: a lista some inteira quando
 * não há nada, em vez de anunciar que está vazia.
 */
export function montarPendencias({
  cobrancaVencida, cobrancaValor, dosesPendentes, primeiraDose,
  checkinPendente, mensagensNaoLidas, treinoPendente, nomeTreino
}) {
  const itens = []

  if (cobrancaVencida) {
    itens.push({
      id: 'pagamento', tipo: 'pagamento', urgente: true,
      selo: 'Vencida',
      titulo: 'Mensalidade vencida',
      detalhe: cobrancaValor ? `${cobrancaValor} · seu treino fica bloqueado até a confirmação` : 'Seu treino fica bloqueado',
      acao: { rotulo: 'Ver', aba: 'pagamentos' }
    })
  }

  if (mensagensNaoLidas > 0) {
    itens.push({
      id: 'chat', tipo: 'chat', urgente: false,
      selo: 'Nova',
      titulo: mensagensNaoLidas === 1 ? 'Nova mensagem do personal' : `${mensagensNaoLidas} mensagens novas`,
      detalhe: 'Do seu personal',
      acao: { rotulo: 'Abrir', aba: 'chat' }
    })
  }

  if (dosesPendentes > 0) {
    itens.push({
      id: 'suplemento', tipo: 'suplemento', urgente: false,
      selo: 'Dose pendente',
      titulo: dosesPendentes === 1 && primeiraDose
        ? `${primeiraDose.nome} ainda não registrado`
        : `${dosesPendentes} doses sem registro hoje`,
      detalhe: dosesPendentes === 1 && primeiraDose
        ? [primeiraDose.dose, primeiraDose.horario && `previsto para ${primeiraDose.horario}`].filter(Boolean).join(' · ')
        : 'Da sua rotina de hoje',
      acao: { rotulo: 'Registrar', aba: 'suplementos' }
    })
  }

  /*
    Treino bloqueado não vira pendência: oferecer "Começar" para quem vai bater
    numa parede é pior do que não oferecer nada. O caminho é a cobrança, que já
    está no topo desta lista.
  */
  if (treinoPendente && !cobrancaVencida) {
    itens.push({
      id: 'treino', tipo: 'treino', urgente: false,
      selo: 'Não iniciado',
      titulo: `${nomeTreino || 'Treino'} ainda não começou`,
      detalhe: 'Previsto para hoje',
      acao: { rotulo: 'Começar', aba: 'treino' }
    })
  }

  if (checkinPendente) {
    itens.push({
      id: 'checkin', tipo: 'checkin', urgente: false,
      selo: 'Disponível',
      titulo: 'Check-in de hoje',
      detalhe: 'Peso, medidas, como você se sentiu — leva um minuto',
      acao: { rotulo: 'Fazer', aba: 'diario' }
    })
  }

  return itens
}

/* ---------------- atalhos ---------------- */

const TODOS_ATALHOS = [
  { id: 'treino', rotulo: 'Treino', aba: 'treino' },
  { id: 'suplementos', rotulo: 'Suplementação', aba: 'suplementos' },
  { id: 'diario', rotulo: 'Check-in', aba: 'diario' },
  { id: 'chat', rotulo: 'Chat', aba: 'chat' },
  { id: 'evolucao', rotulo: 'Evolução', aba: 'evolucao' },
  { id: 'pagamentos', rotulo: 'Pagamentos', aba: 'pagamentos' }
]

/**
 * Atalhos do que NÃO está pendente.
 *
 * O que pede ação já tem botão próprio na lista acima; repetir aqui seria o
 * mesmo botão duas vezes na mesma tela. Então este bloco é o complemento: o
 * caminho para o que a pessoa quer olhar, não para o que ela precisa resolver.
 */
export function montarAtalhos({ pendencias = [], temSuplementos, temTreino, foco, maximo = 4 }) {
  /*
    A comparação é pela ABA de destino, não pelo id. Os ids não batem de
    propósito — a pendência chama "suplemento" (a dose) e o atalho chama
    "suplementos" (a tela) — e comparar por id deixava o mesmo botão aparecer
    duas vezes na mesma tela.
  */
  const jaTem = new Set([
    ...pendencias.map(p => p.acao?.aba),
    foco?.acao?.aba
  ].filter(Boolean))

  return TODOS_ATALHOS
    .filter(a => !jaTem.has(a.aba))
    .filter(a => (a.id === 'suplementos' ? temSuplementos : true))
    .filter(a => (a.id === 'treino' ? temTreino : true))
    .slice(0, maximo)
}

/* ---------------- ações rápidas ---------------- */

/**
 * A grade de atalhos do topo. Diferente das pendências: aqui estão os CAMINHOS,
 * lá está o que precisa ser resolvido.
 *
 * A primeira posição é contextual — recebe o que faz mais sentido agora, e é a
 * única destacada. As outras são fixas, porque atalho que muda de lugar deixa de
 * ser atalho: a mão aprende a posição antes de a pessoa ler o rótulo.
 */
export function montarAcoes({ foco, dosesPendentes, checkinPendente, mensagensNaoLidas, temSuplementos }) {
  const principal = foco?.acao
    ? { id: 'principal', rotulo: rotuloDaAba(foco.acao.aba), sub: foco.acao.rotulo, aba: foco.acao.aba, destaque: true }
    : null

  const fixas = [
    temSuplementos && {
      id: 'suplementos', rotulo: 'Suplementação', aba: 'suplementos',
      sub: dosesPendentes > 0
        ? (dosesPendentes === 1 ? '1 dose pendente' : `${dosesPendentes} doses pendentes`)
        : 'Registrar dose'
    },
    {
      id: 'diario', rotulo: 'Check-in', aba: 'diario',
      sub: checkinPendente ? 'Responder' : 'Feito hoje'
    },
    {
      id: 'chat', rotulo: 'Chat', aba: 'chat',
      sub: mensagensNaoLidas > 0
        ? (mensagensNaoLidas === 1 ? '1 mensagem nova' : `${mensagensNaoLidas} novas`)
        : 'Ver mensagens'
    }
  ].filter(Boolean)

  const usadas = new Set([principal?.aba, ...fixas.map(f => f.aba)].filter(Boolean))
  const resto = TODOS_ATALHOS.filter(a => !usadas.has(a.aba))

  return {
    grade: [principal, ...fixas].filter(Boolean).slice(0, 4),
    // "Ver mais" só existe se realmente sobrou destino — botão que abre lista
    // vazia é pior do que botão nenhum.
    resto
  }
}

const ROTULOS_ABA = {
  inicio: 'Início', treino: 'Treino', evolucao: 'Evolução', diario: 'Check-in',
  suplementos: 'Suplementação', pagamentos: 'Pagamentos', chat: 'Chat', config: 'Configurações'
}
const rotuloDaAba = aba => ROTULOS_ABA[aba] || aba

/* ---------------- o painel inteiro ---------------- */

/** Junta tudo. É o que a tela consome. */
export function montarPainel(dados) {
  const { nome, agora = new Date() } = dados
  const foco = montarFoco(dados)
  const pendencias = montarPendencias({
    ...dados,
    // O treino já é o foco quando está pendente: não vira linha na lista também.
    treinoPendente: dados.treinoPendente && foco.tipo !== 'treino'
  })

  return {
    saudacao: saudacao(nome, agora),
    foco,
    pendencias,
    acoes: montarAcoes({
      foco,
      dosesPendentes: dados.dosesPendentes,
      checkinPendente: dados.checkinPendente,
      mensagensNaoLidas: dados.mensagensNaoLidas,
      temSuplementos: dados.temSuplementos
    }),
    atalhos: montarAtalhos({
      pendencias,
      foco,
      temSuplementos: dados.temSuplementos,
      temTreino: dados.temPlano
    }),
    // Quando não há nada pendente E o dia está resolvido, a tela diz isso.
    tudoEmDia: pendencias.length === 0 &&
      ['treino_concluido', 'descanso'].includes(foco.tipo)
  }
}
