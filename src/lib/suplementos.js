/*
  Suplementação do aluno.

  Dois nós, com donos diferentes:
    suplementos/{alunoUid}/{id}            — o que tomar (aluno OU personal cadastra)
    suplementosTomados/{alunoUid}/{dia}    — o que foi tomado (só o aluno marca)

  Separar é o que permite o personal indicar sem poder marcar por ele. Quem toma
  é o aluno; se o personal pudesse confirmar, a aderência viraria ficção — o
  mesmo motivo pelo qual ele não marca série na prévia do treino.

  O app NÃO recomenda suplemento nem dose. Só acompanha o que foi configurado.

  Limite conhecido: `suplementosTomados` guarda um `ts` por dia, não um por dose.
  Para 2x ao dia só se sabe a hora da última — por isso a hora só é exibida
  quando a dose é única.
*/

export const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export const QUEM_INDICOU = [
  { id: 'nutricionista', rotulo: 'Nutricionista' },
  { id: 'personal', rotulo: 'Personal' },
  { id: 'medico', rotulo: 'Médico' },
  { id: 'proprio', rotulo: 'Por conta própria' }
]

export const FREQUENCIAS = [
  { id: 'diario', rotulo: 'Todos os dias' },
  { id: 'dias', rotulo: 'Dias da semana' },
  { id: 'treino', rotulo: 'Apenas dias de treino' }
]

export const MOMENTOS = [
  { id: 'antes', rotulo: 'Antes do treino' },
  { id: 'durante', rotulo: 'Durante o treino' },
  { id: 'depois', rotulo: 'Após o treino' }
]

export const rotuloMomento = id => MOMENTOS.find(m => m.id === id)?.rotulo || ''

/* ==================== estados da dose ====================

  O aluno declara o que aconteceu. Antes existia só um contador `vezes`, e a
  ausência de registro era lida como falha: quem tomou a creatina e esqueceu de
  abrir o app aparecia no histórico com × "não tomou".

  Isso é diferente de não ter tomado, e o dado precisa dizer qual dos dois foi.
  Por isso `nao_registrado` NÃO é um valor gravado — é a ausência de declaração,
  e nada no sistema converte um no outro.

    tomado          o aluno disse que tomou
    parcial         o aluno disse que tomou parte
    nao_tomado      o aluno disse que não tomou
    nao_registrado  ninguém disse nada ainda      (derivado)
    sem_dose        não havia dose prevista        (derivado)
*/

export const TOMADO = 'tomado'
export const PARCIAL = 'parcial'
export const NAO_TOMADO = 'nao_tomado'
export const NAO_REGISTRADO = 'nao_registrado'
export const SEM_DOSE = 'sem_dose'

/** Os três que o aluno escolhe. Os outros dois são conclusões, não opções. */
export const ESTADOS_DECLARAVEIS = [
  { id: TOMADO, rotulo: 'Tomei', simbolo: '✓' },
  { id: PARCIAL, rotulo: 'Tomei parcialmente', simbolo: '·' },
  { id: NAO_TOMADO, rotulo: 'Não tomei', simbolo: '×' }
]

export const SIMBOLOS = {
  [TOMADO]: '✓', [PARCIAL]: '·', [NAO_TOMADO]: '×',
  [NAO_REGISTRADO]: '?', [SEM_DOSE]: ''
}

export const ROTULOS_ESTADO = {
  [TOMADO]: 'Tomado',
  [PARCIAL]: 'Parcial',
  [NAO_TOMADO]: 'Não tomado',
  [NAO_REGISTRADO]: 'Não registrado',
  [SEM_DOSE]: 'Sem dose prevista'
}

const DECLARADOS = [TOMADO, PARCIAL, NAO_TOMADO]
export const ehDeclarado = e => DECLARADOS.includes(e)

/**
 * Lê o registro bruto de um dia e devolve o estado declarado, ou null.
 *
 * Migração: registro antigo tem `vezes` e não tem `estado`. Como só existia
 * registro quando a pessoa marcou pelo menos uma dose, ele vira `tomado` ou
 * `parcial` conforme a contagem — nenhum histórico antigo vira "não tomou".
 */
export function registroDoDia(tomados, supId, dia, vezesAoDia = 1) {
  const bruto = tomados?.[dia]?.[supId]
  if (!bruto) return null

  const vezes = Number(bruto.vezes) || 0
  const estado = ehDeclarado(bruto.estado)
    ? bruto.estado
    : (vezes >= vezesAoDia ? TOMADO : vezes > 0 ? PARCIAL : null)

  if (!estado) return null
  return { estado, vezes, ts: bruto.ts || null, retroativo: bruto.retroativo === true }
}

/**
 * O estado de um suplemento num dia: o que a tela pinta.
 * `previstaNoDia` diz se havia dose — sem ela, o dia é descanso, não omissão.
 */
export function estadoNoDia(sup, supId, tomados, dia, previstaNoDia) {
  if (!previstaNoDia) return SEM_DOSE
  const r = registroDoDia(tomados, supId, dia, sup?.vezesAoDia || 1)
  return r ? r.estado : NAO_REGISTRADO
}

/** 2026-09-02 — chave do dia, no fuso local. */
export const diaISO = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

const meiaNoite = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

export const suplementoVazio = () => ({
  nome: '',
  marca: '',
  dose: '',
  vezesAoDia: 1,
  frequencia: 'diario',
  dias: [],
  momento: 'depois',
  horario: '',
  indicadoPor: 'proprio',
  observacao: '',
  ativo: true,
  pausadoAte: null,
  // Ver src/lib/lembretes.js: o que faz o celular tocar.
  lembrete: { ativo: false, horarios: [], antecedencia: 0, cobrar: true }
})

/** Preenche o que faltar, para registro antigo não quebrar a tela. */
export function normalizarSuplemento(s) {
  if (!s) return null
  return {
    ...suplementoVazio(),
    ...s,
    vezesAoDia: Math.max(1, Number(s.vezesAoDia) || 1),
    dias: Array.isArray(s.dias) ? s.dias : [],
    ativo: s.ativo !== false,
    pausadoAte: s.pausadoAte || null
  }
}

/* ==================== estado ==================== */

/**
 * Pausa temporária. Diferente de `ativo: false`, que é indefinido: aqui o
 * suplemento volta sozinho na data marcada, sem ninguém precisar lembrar.
 */
export function estaPausado(sup, hoje = new Date()) {
  if (sup?.ativo === false) return true
  if (!sup?.pausadoAte) return false
  return diaISO(hoje) <= sup.pausadoAte
}

/** Texto do porquê de não estar na rotina hoje. Vazio quando está ativo. */
export function motivoPausa(sup, hoje = new Date()) {
  if (sup?.ativo === false) return 'Pausado'
  if (sup?.pausadoAte && diaISO(hoje) <= sup.pausadoAte) {
    const [a, m, d] = sup.pausadoAte.split('-')
    return `Pausado até ${d}/${m}`
  }
  return ''
}

/**
 * Se o suplemento entra no dia.
 * `treinou` só importa para a frequência "apenas dias de treino" — sem ele,
 * um pós-treino apareceria como pendente em dia de descanso.
 */
export function tocaHoje(sup, hoje = new Date(), treinou = false) {
  if (!sup || estaPausado(sup, hoje)) return false
  if (sup.frequencia === 'dias') return (sup.dias || []).includes(hoje.getDay())
  if (sup.frequencia === 'treino') return treinou
  return true
}

/** Quantas vezes foi tomado num dia. */
export const vezesNoDia = (tomados, supId, dia) =>
  Number(tomados?.[dia]?.[supId]?.vezes) || 0

/** Hora da última dose registrada no dia, ou null. */
export function horaDaDose(tomados, supId, dia) {
  const ts = tomados?.[dia]?.[supId]?.ts
  if (!ts) return null
  const d = new Date(ts)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

/**
 * Falta resolver hoje? É o que acende o aviso flutuante e o badge do menu.
 *
 * Quem declarou "não tomei" não é mais cobrado: ele já respondeu. Cobrar de novo
 * seria o app discordando de uma informação que a própria pessoa deu.
 */
export function faltaHoje(sup, supId, tomados, hoje = new Date(), treinou = false) {
  if (!tocaHoje(sup, hoje, treinou)) return false
  const r = registroDoDia(tomados, supId, diaISO(hoje), sup.vezesAoDia)
  if (!r) return true                       // não registrado: falta responder
  if (r.estado === NAO_TOMADO) return false // respondeu, e a resposta foi não
  return r.vezes < sup.vezesAoDia           // parcial com dose restante
}

/* ==================== o dia ==================== */

/**
 * Rotina de hoje, já ordenada por urgência: atrasada primeiro, depois a que tem
 * horário mais próximo, depois as sem horário, e as concluídas por último.
 * Ordem alfabética não ajuda quem abre o app para saber o que tomar agora.
 */
export function rotinaDeHoje(lista, tomados, agora = new Date(), treinou = false) {
  const dia = diaISO(agora)
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()

  const doDia = lista
    .filter(s => tocaHoje(s, agora, treinou))
    .map(s => {
      const reg = registroDoDia(tomados, s.id, dia, s.vezesAoDia)
      const estado = reg ? reg.estado : NAO_REGISTRADO
      const feitas = reg?.vezes || 0
      // `completo` é a dose cheia; `resolvido` é ter respondido, seja o que for.
      const completo = estado === TOMADO
      const resolvido = ehDeclarado(estado)
      const min = horarioEmMinutos(s.horario)
      return {
        ...s,
        feitas,
        estado,
        resolvido,
        completo,
        hora: horaDaDose(tomados, s.id, dia),
        minutosDoHorario: min,
        atrasada: !resolvido && min !== null && min < minutosAgora,
        minutosAte: !resolvido && min !== null && min >= minutosAgora ? min - minutosAgora : null
      }
    })

  /*
    Ordem por urgência:
      1. concluídas sempre no fim
      2. pós-treino pendente, quando houve treino hoje — o momento é agora, e é
         o único caso em que o app sabe algo que a pessoa não digitou
      3. atrasada pelo relógio
      4. horário mais próximo; sem horário, no fim
      5. alfabética, para a ordem não dançar entre renderizações

    O passo 2 existe porque sem ele o pós-treino perdia para qualquer suplemento
    com horário marcado, e o bloco "agora" oferecia a dose errada logo depois do
    treino — justamente quando ele deveria acertar.
  */
  doDia.sort((a, b) => {
    if (a.resolvido !== b.resolvido) return a.resolvido ? 1 : -1

    const aPos = treinou && a.frequencia === 'treino'
    const bPos = treinou && b.frequencia === 'treino'
    if (aPos !== bPos) return aPos ? -1 : 1

    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1

    const ma = a.minutosDoHorario ?? 99999
    const mb = b.minutosDoHorario ?? 99999
    if (ma !== mb) return ma - mb
    return (a.nome || '').localeCompare(b.nome || '')
  })

  /*
    O contador do topo conta o que foi RESPONDIDO, não só o que foi tomado —
    "1 de 2 doses registradas". Quem disse "não tomei" resolveu o dia dele, e
    a barra precisa refletir isso, senão o app fica devendo para sempre.
  */
  const dosesTotal = doDia.length
  const dosesFeitas = doDia.filter(s => s.resolvido).length
  const dosesTomadas = doDia.filter(s => s.completo).length

  return {
    itens: doDia,
    dosesTotal,
    dosesFeitas,
    pct: dosesTotal ? Math.round((dosesFeitas / dosesTotal) * 100) : 0,
    dosesTomadas,
    tudoFeito: dosesTotal > 0 && dosesFeitas >= dosesTotal,
    pendentes: doDia.filter(s => !s.resolvido)
  }
}

const horarioEmMinutos = h => {
  if (!h || !/^\d{1,2}:\d{2}$/.test(h)) return null
  const [hh, mm] = h.split(':').map(Number)
  return hh * 60 + mm
}

/** A próxima dose a tomar, para o bloco "agora". Null quando não há pendência. */
export function proximaDose(rotina) {
  return rotina.pendentes.find(s => s.atrasada) || rotina.pendentes[0] || null
}

/** Caminho da dose no banco. Um lugar só, para os quatro pontos que escrevem. */
export const caminhoDose = (alunoId, dia, supId) =>
  `suplementosTomados/${alunoId}/${dia}/${supId}`

/** "em 42 min" / "em 2h10" — só quando existe horário no futuro. */
export function faltamPara(minutos) {
  if (minutos === null || minutos === undefined) return ''
  if (minutos < 60) return `em ${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `em ${h}h` : `em ${h}h${String(m).padStart(2, '0')}`
}

/* ==================== constância ==================== */

/*
  Como a adesão é calculada, e por que assim.

  O percentual é sobre o que o aluno INFORMOU, não sobre o calendário. Dose que
  ele não registrou fica fora da conta e aparece ao lado, contada à parte.

  A alternativa — tratar o silêncio como falha — é o que existia antes, e mentia:
  quem tomava direitinho mas só abria o app duas vezes por semana via 30% de
  adesão. O número virava motivo para desistir do app, não para tomar o suplemento.

  Contar o silêncio como acerto mentiria na direção oposta. Por isso ele não entra
  no percentual, mas fica visível: "82% — 18 de 22 doses informadas · 9 sem registro"
  é uma frase que a pessoa consegue avaliar sozinha.

  Parcial vale meia dose. É convenção, e a tela diz isso.
*/

export const PESO = { [TOMADO]: 1, [PARCIAL]: 0.5, [NAO_TOMADO]: 0 }

/**
 * Dias seguidos com dose registrada, de hoje para trás.
 *
 * Dia sem dose prevista é pulado, não quebra. Dia não registrado QUEBRA: uma
 * sequência é a prova de um hábito, e não dá para provar o que não foi anotado.
 * A tela chama isso de "dias seguidos registrados", para o nome não prometer
 * mais do que o dado sustenta.
 */
export function sequencia(sup, supId, tomados, hoje = new Date(), previsto = null) {
  if (!sup) return 0
  const toca = previsto || ((s, d) => tocaHoje(s, d, true))
  const cursor = meiaNoite(hoje)

  // Hoje ainda incompleto não zera a conta: o dia não acabou.
  if (toca(sup, cursor) && registroDoDia(tomados, supId, diaISO(cursor), sup.vezesAoDia)?.estado !== TOMADO) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let n = 0
  for (let i = 0; i < 400; i++) {
    if (toca(sup, cursor)) {
      if (registroDoDia(tomados, supId, diaISO(cursor), sup.vezesAoDia)?.estado === TOMADO) n++
      else break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

/** A maior sequência já alcançada, para dar régua à sequência atual. */
export function melhorSequencia(sup, supId, tomados, janela = 365, hoje = new Date(), previsto = null) {
  if (!sup) return 0
  const toca = previsto || ((s, d) => tocaHoje(s, d, true))
  const cursor = meiaNoite(hoje)
  let melhor = 0
  let atual = 0

  for (let i = 0; i < janela; i++) {
    if (toca(sup, cursor)) {
      if (registroDoDia(tomados, supId, diaISO(cursor), sup.vezesAoDia)?.estado === TOMADO) {
        atual++
        if (atual > melhor) melhor = atual
      } else atual = 0
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return melhor
}

/**
 * Adesão de um suplemento no período.
 *
 * Devolve os quatro números separados, porque é isso que permite à tela ser
 * honesta: o percentual sozinho esconde de onde veio. `null` quando nada era
 * previsto — suplemento recém-cadastrado marcando 0% desanima antes de começar.
 */
export function aderencia(sup, supId, tomados, janela = 30, hoje = new Date(), previsto = null) {
  if (!sup) return null
  const toca = previsto || ((s, d) => tocaHoje(s, d, true))
  const cursor = meiaNoite(hoje)

  let previstas = 0, tomadas = 0, parciais = 0, naoTomadas = 0, naoRegistradas = 0

  /*
    Compara dia com dia, não instante com instante: cadastrado às 10h, o `inicio`
    seria maior que a meia-noite de hoje e o próprio dia do cadastro ficaria de
    fora da conta — para sempre, não só hoje.
  */
  const desde = sup.inicio ? meiaNoite(new Date(sup.inicio)) : null

  for (let i = 0; i < janela; i++) {
    if (desde && cursor.getTime() >= desde.getTime() && toca(sup, cursor)) {
      previstas++
      const r = registroDoDia(tomados, supId, diaISO(cursor), sup.vezesAoDia)
      if (!r) naoRegistradas++
      else if (r.estado === TOMADO) tomadas++
      else if (r.estado === PARCIAL) parciais++
      else naoTomadas++
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  if (previstas === 0) return null
  const informadas = tomadas + parciais + naoTomadas
  const pontos = tomadas * PESO[TOMADO] + parciais * PESO[PARCIAL]
  return {
    previstas, tomadas, parciais, naoTomadas, naoRegistradas, informadas,
    pct: informadas === 0 ? null : Math.round((pontos / informadas) * 100)
  }
}

/** Adesão somada de todos os suplementos — a régua da rotina inteira. */
export function aderenciaGeral(lista, tomados, janela = 30, hoje = new Date(), previsto = null) {
  const t = { previstas: 0, tomadas: 0, parciais: 0, naoTomadas: 0, naoRegistradas: 0, informadas: 0 }
  lista.forEach(s => {
    const a = aderencia(s, s.id, tomados, janela, hoje, previsto)
    if (!a) return
    Object.keys(t).forEach(k => { t[k] += a[k] })
  })
  if (t.previstas === 0) return null
  const pontos = t.tomadas * PESO[TOMADO] + t.parciais * PESO[PARCIAL]
  return { ...t, pct: t.informadas === 0 ? null : Math.round((pontos / t.informadas) * 100) }
}

/* ==================== histórico ==================== */

/**
 * Um item por dia, do mais antigo para o mais novo, com o detalhe de cada
 * suplemento — é o que permite tocar num dia e corrigir a dose daquele dia.
 *
 * O estado do DIA é o pior entre os suplementos, com uma ordem de gravidade:
 * não tomado > não registrado > parcial > tomado. Assim um dia com três acertos
 * e uma omissão não se pinta de verde.
 */
const GRAVIDADE = { [NAO_TOMADO]: 4, [NAO_REGISTRADO]: 3, [PARCIAL]: 2, [TOMADO]: 1 }

export function historico(lista, tomados, janela = 30, hoje = new Date(), previsto = null) {
  const toca = previsto || ((s, d) => tocaHoje(s, d, true))
  const saida = []
  const cursor = meiaNoite(hoje)
  cursor.setDate(cursor.getDate() - (janela - 1))
  const hojeISO = diaISO(hoje)

  for (let i = 0; i < janela; i++) {
    const iso = diaISO(cursor)
    const itens = []

    lista.forEach(s => {
      const desde = s.inicio ? meiaNoite(new Date(s.inicio)) : null
      if (!desde || cursor.getTime() < desde.getTime()) return
      if (!toca(s, cursor)) return
      const r = registroDoDia(tomados, s.id, iso, s.vezesAoDia)
      itens.push({
        id: s.id, nome: s.nome, dose: s.dose, horario: s.horario, vezesAoDia: s.vezesAoDia,
        estado: r ? r.estado : NAO_REGISTRADO,
        vezes: r?.vezes || 0,
        ts: r?.ts || null
      })
    })

    const pior = itens.reduce(
      (acc, it) => (GRAVIDADE[it.estado] > GRAVIDADE[acc] ? it.estado : acc),
      TOMADO
    )

    saida.push({
      iso,
      data: new Date(cursor),
      itens,
      futuro: iso > hojeISO,
      estado: itens.length === 0 ? SEM_DOSE : pior,
      previstas: itens.length,
      informadas: itens.filter(it => ehDeclarado(it.estado)).length
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return saida
}

/* ==================== texto ==================== */

/** "2 scoops · 2x ao dia · seg, qua, sex" */
export function resumoSuplemento(sup) {
  const partes = []
  if (sup.dose) partes.push(sup.dose)
  if (sup.vezesAoDia > 1) partes.push(sup.vezesAoDia + 'x ao dia')

  if (sup.frequencia === 'dias' && sup.dias?.length) {
    partes.push(sup.dias.slice().sort().map(d => DIAS_SEMANA[d]).join(', '))
  } else if (sup.frequencia === 'treino') {
    partes.push(rotuloMomento(sup.momento).toLowerCase())
  } else {
    partes.push('todo dia')
  }

  if (sup.horario) partes.push(sup.horario)
  return partes.join(' · ')
}
