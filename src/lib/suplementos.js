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
  pausadoAte: null
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

/** Falta tomar hoje? */
export function faltaHoje(sup, supId, tomados, hoje = new Date(), treinou = false) {
  if (!tocaHoje(sup, hoje, treinou)) return false
  return vezesNoDia(tomados, supId, diaISO(hoje)) < sup.vezesAoDia
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
      const feitas = vezesNoDia(tomados, s.id, dia)
      const completo = feitas >= s.vezesAoDia
      const min = horarioEmMinutos(s.horario)
      return {
        ...s,
        feitas,
        completo,
        hora: horaDaDose(tomados, s.id, dia),
        minutosDoHorario: min,
        atrasada: !completo && min !== null && min < minutosAgora,
        minutosAte: !completo && min !== null && min >= minutosAgora ? min - minutosAgora : null
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
    if (a.completo !== b.completo) return a.completo ? 1 : -1

    const aPos = treinou && a.frequencia === 'treino'
    const bPos = treinou && b.frequencia === 'treino'
    if (aPos !== bPos) return aPos ? -1 : 1

    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1

    const ma = a.minutosDoHorario ?? 99999
    const mb = b.minutosDoHorario ?? 99999
    if (ma !== mb) return ma - mb
    return (a.nome || '').localeCompare(b.nome || '')
  })

  const dosesTotal = doDia.reduce((n, s) => n + s.vezesAoDia, 0)
  const dosesFeitas = doDia.reduce((n, s) => n + Math.min(s.feitas, s.vezesAoDia), 0)

  return {
    itens: doDia,
    dosesTotal,
    dosesFeitas,
    pct: dosesTotal ? Math.round((dosesFeitas / dosesTotal) * 100) : 0,
    tudoFeito: dosesTotal > 0 && dosesFeitas >= dosesTotal,
    pendentes: doDia.filter(s => !s.completo)
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

/** "em 42 min" / "em 2h10" — só quando existe horário no futuro. */
export function faltamPara(minutos) {
  if (minutos === null || minutos === undefined) return ''
  if (minutos < 60) return `em ${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `em ${h}h` : `em ${h}h${String(m).padStart(2, '0')}`
}

/* ==================== constância ==================== */

/**
 * Dias seguidos cumprindo a dose cheia, contando de hoje para trás.
 * Dia em que o suplemento não toca é pulado, não quebra a sequência — quem toma
 * só de segunda a sexta não perde a conta no domingo.
 */
export function sequencia(sup, supId, tomados, hoje = new Date()) {
  if (!sup) return 0
  const cursor = meiaNoite(hoje)

  // Hoje ainda incompleto não zera a conta: o dia não acabou.
  if (tocaHoje(sup, cursor, true) && vezesNoDia(tomados, supId, diaISO(cursor)) < sup.vezesAoDia) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let n = 0
  for (let i = 0; i < 400; i++) {
    if (tocaHoje(sup, cursor, true)) {
      if (vezesNoDia(tomados, supId, diaISO(cursor)) >= sup.vezesAoDia) n++
      else break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

/** A maior sequência já alcançada, para dar régua à sequência atual. */
export function melhorSequencia(sup, supId, tomados, janela = 365, hoje = new Date()) {
  if (!sup) return 0
  const cursor = meiaNoite(hoje)
  let melhor = 0
  let atual = 0

  for (let i = 0; i < janela; i++) {
    if (tocaHoje(sup, cursor, true)) {
      if (vezesNoDia(tomados, supId, diaISO(cursor)) >= sup.vezesAoDia) {
        atual++
        if (atual > melhor) melhor = atual
      } else atual = 0
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return melhor
}

/**
 * Adesão de um suplemento: doses cumpridas sobre doses esperadas.
 * Devolve null quando nada era esperado — suplemento recém-cadastrado marcando
 * 0% é injusto e desanima antes de a rotina começar.
 */
export function aderencia(sup, supId, tomados, janela = 30, hoje = new Date()) {
  if (!sup) return null
  let esperadas = 0
  let cumpridas = 0
  const cursor = meiaNoite(hoje)

  /*
    Compara dia com dia, não instante com instante: cadastrado às 10h, o `inicio`
    seria maior que a meia-noite de hoje e o próprio dia do cadastro ficaria de
    fora da conta — para sempre, não só hoje.
  */
  const desde = sup.inicio ? meiaNoite(new Date(sup.inicio)) : null

  for (let i = 0; i < janela; i++) {
    if (desde && cursor.getTime() >= desde.getTime() && tocaHoje(sup, cursor, true)) {
      esperadas += sup.vezesAoDia
      cumpridas += Math.min(vezesNoDia(tomados, supId, diaISO(cursor)), sup.vezesAoDia)
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  if (esperadas === 0) return null
  return { pct: Math.round((cumpridas / esperadas) * 100), cumpridas, esperadas }
}

/** Adesão somada de todos os suplementos — a régua da rotina inteira. */
export function aderenciaGeral(lista, tomados, janela = 30, hoje = new Date()) {
  let cumpridas = 0
  let esperadas = 0
  lista.forEach(s => {
    const a = aderencia(s, s.id, tomados, janela, hoje)
    if (a) { cumpridas += a.cumpridas; esperadas += a.esperadas }
  })
  if (esperadas === 0) return null
  return { pct: Math.round((cumpridas / esperadas) * 100), cumpridas, esperadas }
}

/* ==================== histórico ==================== */

/**
 * Um item por dia, do mais antigo para o mais novo.
 * `esperadas: 0` marca dia em que nada era devido — não é falha, é descanso, e
 * a tela precisa distinguir os dois.
 */
export function historico(lista, tomados, janela = 30, hoje = new Date()) {
  const saida = []
  const cursor = meiaNoite(hoje)
  cursor.setDate(cursor.getDate() - (janela - 1))

  for (let i = 0; i < janela; i++) {
    const iso = diaISO(cursor)
    let esperadas = 0
    let cumpridas = 0

    lista.forEach(s => {
      const desde = s.inicio ? meiaNoite(new Date(s.inicio)) : null
      if (!desde || cursor.getTime() < desde.getTime()) return
      if (!tocaHoje(s, cursor, true)) return
      esperadas += s.vezesAoDia
      cumpridas += Math.min(vezesNoDia(tomados, s.id, iso), s.vezesAoDia)
    })

    saida.push({
      iso,
      data: new Date(cursor),
      esperadas,
      cumpridas,
      estado: esperadas === 0 ? 'nada' : cumpridas >= esperadas ? 'ok' : cumpridas > 0 ? 'parcial' : 'falhou'
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
